import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteUserAccount } from "./account-server";

// The core deletion lives in deleteUserAccount and imports the service-role
// client lazily — mock that module so the test never needs real credentials.
// The admin client is typed loosely so the test can stub GoTrue responses
// without reconstructing the full User/AuthError shapes.
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        deleteUser: vi.fn(),
      },
    },
  },
}));

const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
const deleteUser = supabaseAdmin.auth.admin.deleteUser as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  deleteUser.mockReset();
});

describe("deleteUserAccount", () => {
  it("deletes the auth user via the service-role admin client", async () => {
    deleteUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });

    await expect(deleteUserAccount("user-1")).resolves.toEqual({ ok: true });
    expect(deleteUser).toHaveBeenCalledExactlyOnceWith("user-1");
  });

  it("throws when the admin client reports an error", async () => {
    deleteUser.mockResolvedValueOnce({ data: null, error: new Error("user not found") });

    await expect(deleteUserAccount("user-1")).rejects.toThrow("user not found");
  });
});
