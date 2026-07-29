import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export interface SessionFiltersState {
  search: string;
  type: string;
}

interface SessionFiltersProps {
  filters: SessionFiltersState;
  onChange: (filters: SessionFiltersState) => void;
}

export function SessionFilters({ filters, onChange }: SessionFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Input
        placeholder="Search sessions..."
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        className="w-48 h-8 text-sm"
      />
      <Select value={filters.type} onValueChange={(v) => onChange({ ...filters, type: v })}>
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="skill_exchange">Skill Exchange</SelectItem>
          <SelectItem value="mentoring">Mentoring</SelectItem>
          <SelectItem value="project_meeting">Project Meeting</SelectItem>
          <SelectItem value="study_session">Study Session</SelectItem>
          <SelectItem value="workshop">Workshop</SelectItem>
          <SelectItem value="general">General</SelectItem>
        </SelectContent>
      </Select>
      {(filters.search || (filters.type && filters.type !== "all")) && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onChange({ search: "", type: "" })}>
          Clear
        </Button>
      )}
    </div>
  );
}
