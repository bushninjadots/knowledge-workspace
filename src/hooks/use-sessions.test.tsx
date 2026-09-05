import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useAddSessionNote,
  useCreateSession,
  useRespondToRequest,
  useSendSessionRequest,
  useSetSessionAvailability,
  useUpdateParticipantStatus,
} from "./use-sessions";
import { createFakeSupabase } from "../../tests/helpers/fake-supabase";

// --- Mocks ---------------------------------------------------------------

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// The sessions hooks only consume the signed-in id from useCurrentUser —
// substitute a fixed identity instead of faking the entire profile fetch.
vi.mock("./use-current-user", () => ({
  useCurrentUser: () => ({ data: { userId: "user-1" } }),
}));

const fake = vi.hoisted(() => ({
  supabase: {} as {
    from: ReturnType<typeof vi.fn>;
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: fake.supabase }));

const handle = createFakeSupabase();

function renderHookWithClient<TReturn>(useHook: () => TReturn) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  fake.supabase.from = handle.client.from;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { ...renderHook(useHook, { wrapper }), qc };
}

beforeEach(() => handle.reset());

function lastCallOf(table: string, action: string) {
  return handle.calls.filter((c) => c.table === table && c.action === action).at(-1);
}

// --- useCreateSession -----------------------------------------------------

describe("useCreateSession", () => {
  it("creates a scheduled session with computed end time and UTC default TZ", async () => {
    handle.on("sessions:insert", () => ({ data: { id: "s-1" }, error: null }));

    const { result } = renderHookWithClient(() => useCreateSession());
    const startsAt = "2026-09-10T10:00:00.000Z";
    await act(async () => {
      await result.current.mutateAsync({
        title: "Design review",
        session_type: "project_meeting",
        starts_at: startsAt,
        duration_minutes: 90,
      });
    });

    const insert = lastCallOf("sessions", "insert");
    expect(insert?.value).toMatchObject({
      organizer_id: "user-1",
      title: "Design review",
      session_type: "project_meeting",
      status: "scheduled",
      starts_at: startsAt,
      ends_at: "2026-09-10T11:30:00.000Z",
      duration_minutes: 90,
      timezone: "UTC",
      meeting_url: null,
      location: null,
      skill_id: null,
      project_id: null,
    });
    expect(handle.calls.some((c) => c.table === "session_participants")).toBe(false);
  });

  it("seats invited participants when they are provided and flags the session invitation_sent", async () => {
    handle.on("sessions:insert", () => ({ data: { id: "s-1" }, error: null }));
    handle.on("session_participants:insert", () => ({ data: null, error: null }));

    const { result } = renderHookWithClient(() => useCreateSession());
    await act(async () => {
      await result.current.mutateAsync({
        title: "Pairing",
        session_type: "study_session",
        starts_at: "2026-09-10T10:00:00.000Z",
        duration_minutes: 30,
        timezone: "Europe/Madrid",
        participant_ids: ["p-a", "p-b"],
      });
    });

    expect(lastCallOf("sessions", "insert")?.value).toMatchObject({ status: "invitation_sent" });
    const partInsert = lastCallOf("session_participants", "insert");
    expect(partInsert?.value).toEqual([
      { session_id: "s-1", profile_id: "p-a", role: "participant", status: "invited" },
      { session_id: "s-1", profile_id: "p-b", role: "participant", status: "invited" },
    ]);
  });

  it("invalidates the whole sessions catalog on success", async () => {
    handle.on("sessions:insert", () => ({ data: { id: "s-1" }, error: null }));

    const { result, qc } = renderHookWithClient(() => useCreateSession());
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    await act(async () => {
      await result.current.mutateAsync({
        title: "X",
        session_type: "general",
        starts_at: "2026-09-10T10:00:00.000Z",
        duration_minutes: 30,
      });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["sessions"] });
  });
});

// --- useAddSessionNote -----------------------------------------------------

describe("useAddSessionNote", () => {
  it("inserts a v1 note owned by the current user and invalidates that note stream", async () => {
    handle.on("session_notes:insert", () => ({ data: { id: "n-1" }, error: null }));

    const { result, qc } = renderHookWithClient(() => useAddSessionNote());
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    await act(async () => {
      await result.current.mutateAsync({ sessionId: "s-1", content: "Action items" });
    });

    expect(lastCallOf("session_notes", "insert")?.value).toEqual({
      session_id: "s-1",
      content: "Action items",
      version: 1,
      created_by: "user-1",
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["sessions", "notes", "s-1"] });
  });
});

// --- useRespondToRequest ---------------------------------------------------

describe("useRespondToRequest", () => {
  it("writes the response status with a timestamp and refreshes requests", async () => {
    handle.on("session_requests:update", () => ({ data: { id: "r-1" }, error: null }));

    const { result, qc } = renderHookWithClient(() => useRespondToRequest());
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    await act(async () => {
      await result.current.mutateAsync({ requestId: "r-1", status: "accepted" });
    });

    const update = lastCallOf("session_requests", "update");
    expect(update?.value).toMatchObject({ status: "accepted" });
    const { responded_at } = update!.value as { responded_at: string };
    expect(new Date(responded_at).toISOString()).toBe(responded_at);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["sessions", "requests", "user-1"] });
  });
});

// --- useSendSessionRequest -------------------------------------------------

describe("useSendSessionRequest", () => {
  it("inserts a request with optional message and suggested time", async () => {
    handle.on("session_requests:insert", () => ({ data: { id: "r-1" }, error: null }));

    const { result } = renderHookWithClient(() => useSendSessionRequest());
    await act(async () => {
      await result.current.mutateAsync({
        toUserId: "p-a",
        message: "Want to pair?",
        suggestedTime: "2026-09-11T09:00:00Z",
      });
    });

    expect(lastCallOf("session_requests", "insert")?.value).toEqual({
      from_user_id: "user-1",
      to_user_id: "p-a",
      message: "Want to pair?",
      suggested_time: "2026-09-11T09:00:00Z",
    });
  });

  it("stores nulls when the optional fields are omitted", async () => {
    handle.on("session_requests:insert", () => ({ data: { id: "r-1" }, error: null }));

    const { result } = renderHookWithClient(() => useSendSessionRequest());
    await act(async () => {
      await result.current.mutateAsync({ toUserId: "p-a" });
    });

    expect(lastCallOf("session_requests", "insert")?.value).toEqual({
      from_user_id: "user-1",
      to_user_id: "p-a",
      message: null,
      suggested_time: null,
    });
  });
});

// --- useSetSessionAvailability ---------------------------------------------

describe("useSetSessionAvailability", () => {
  it("replaces the user's slots with timezone scoped rows", async () => {
    handle.on("session_availability:delete", () => ({ data: null, error: null }));
    handle.on("session_availability:insert", () => ({ data: null, error: null }));

    const { result } = renderHookWithClient(() => useSetSessionAvailability());
    await act(async () => {
      await result.current.mutateAsync({
        slots: [
          { day_of_week: 1, start_time: "09:00", end_time: "10:00", status: "available" },
          { day_of_week: 3, start_time: "18:00", end_time: "19:00", status: "available" },
        ],
        timezone: "Europe/Madrid",
      });
    });

    expect(lastCallOf("session_availability", "insert")?.value).toEqual([
      {
        day_of_week: 1,
        start_time: "09:00",
        end_time: "10:00",
        status: "available",
        profile_id: "user-1",
        timezone: "Europe/Madrid",
      },
      {
        day_of_week: 3,
        start_time: "18:00",
        end_time: "19:00",
        status: "available",
        profile_id: "user-1",
        timezone: "Europe/Madrid",
      },
    ]);
  });

  it("clears all availability when given an empty slot list", async () => {
    handle.on("session_availability:delete", () => ({ data: null, error: null }));

    const { result } = renderHookWithClient(() => useSetSessionAvailability());
    await act(async () => {
      await result.current.mutateAsync({ slots: [], timezone: "UTC" });
    });

    expect(handle.calls.some((c) => c.action === "insert")).toBe(false);
  });
});

// --- useUpdateParticipantStatus ---------------------------------------------

describe("useUpdateParticipantStatus", () => {
  it("writes the participant response and refreshes the session detail", async () => {
    handle.on("session_participants:update", () => ({ data: { id: "p-1" }, error: null }));

    const { result, qc } = renderHookWithClient(() => useUpdateParticipantStatus());
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    await act(async () => {
      await result.current.mutateAsync({
        participantId: "p-1",
        status: "accepted",
        sessionId: "s-1",
      });
    });

    const update = lastCallOf("session_participants", "update");
    expect(update?.value).toMatchObject({ status: "accepted" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["sessions", "detail", "s-1"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["sessions"] });
  });
});
