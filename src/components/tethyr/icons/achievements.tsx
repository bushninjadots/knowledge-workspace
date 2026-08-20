import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const svgBase = {
  viewBox: "0 0 24 24",
  fill: "none",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconFirstProject(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <path d="M12 2L8 10H16L12 2Z" />
      <path d="M8 10L6 14H8" />
      <path d="M16 10L18 14H16" />
      <path d="M12 14C12 14 10 16 9 17C8 18 8 19 9 19.5C10 20 11 19.5 12 18.5C13 19.5 14 20 15 19.5C16 19 16 18 15 17C14 16 12 14 12 14Z" />
    </svg>
  );
}

export function IconFirstMilestone(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <path d="M6 20V4" />
      <path d="M6 4L16 7L6 10" />
      <path d="M16 7L18 6M16 7L18 8M16 7L17 5.5" />
    </svg>
  );
}

export function IconFirstEndorsement(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <path d="M7 22V11L10 2C10.5 2 11 2.5 11 3V9H18C19 9 19.8 9.8 19.6 10.8L18 20C17.8 21 17 22 16 22H7Z" />
      <path d="M4 13L3 12L4 11" />
      <path d="M3 12H5" />
    </svg>
  );
}

export function IconFiveEndorsements(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <path d="M12 2L14.5 8.5L21.5 9L16.5 13.5L18 20.5L12 17L6 20.5L7.5 13.5L2.5 9L9.5 8.5L12 2Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconTenEndorsements(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <circle cx="12" cy="14" r="6" />
      <path d="M9 8L12 2L15 8" />
      <path d="M10 14C10 13 11 12 12 13C13 12 14 13 14 14C14 15 13 16 12 15C11 16 10 15 10 14Z" />
    </svg>
  );
}

export function IconCommunityRecognized(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <path d="M12 2L3 6V12C3 17 7 21 12 22C17 21 21 17 21 12V6L12 2Z" />
      <path d="M8 12L11 15L16 9" />
    </svg>
  );
}

export function IconMentor(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <path d="M12 3L2 9L12 15L22 9L12 3Z" />
      <path d="M6 12V18C6 18 8 20 12 20C16 20 18 18 18 18V12" />
      <path d="M11 19C11 18.5 11.5 18 12 18.5C12.5 18 13 18.5 13 19" />
    </svg>
  );
}

export function IconCollaborator(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21V18C3 16 5 14 7 14H11C13 14 15 16 15 18V21" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M15 21V19C15 17.5 16 16.5 17 16.5H19C20 16.5 21 17.5 21 19V21" />
      <path d="M12 11C12 11 14 10 15 9" />
    </svg>
  );
}

export function IconProlificTeacher(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <path d="M2 4C2 4 6 3 12 5V20C6 18 2 19 2 19" />
      <path d="M22 4C22 4 18 3 12 5V20C18 18 22 19 22 19" />
      <path d="M12 5L12 1" />
      <path d="M12 5L9 2" />
      <path d="M12 5L15 2" />
    </svg>
  );
}

export function IconProjectBuilder(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <path d="M3 15L8 10L14 16L9 21Z" />
      <path d="M8 10L18 4" />
      <path d="M16 18H20V22" />
    </svg>
  );
}

export function IconCommunityBuilder(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <path d="M3 4H21V16H13L8 20V16H3V4Z" />
      <circle cx="8" cy="10" r="1.5" />
      <circle cx="12" cy="10" r="1.5" />
      <circle cx="16" cy="10" r="1.5" />
    </svg>
  );
}

export function IconReliableCollaborator(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7V12L15 15" />
      <path d="M9 12C9 11.2 10 10.5 11 11.2C12 10.5 13 11.2 13 12C13 12.8 12 13.5 11 12.8C10 13.5 9 12.8 9 12Z" />
    </svg>
  );
}

export function IconHelpedTenPeople(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <path d="M12 21C12 21 3 15 3 9C3 6 5.5 3.5 8 3.5C9.5 3.5 11 4.5 12 6C13 4.5 14.5 3.5 16 3.5C18.5 3.5 21 6 21 9C21 15 12 21 12 21Z" />
      <path d="M7 16C5 17 4 18 5 19" />
      <path d="M17 16C19 17 20 18 19 19" />
    </svg>
  );
}

export function IconLearnerJourney(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M16 8L14 14L8 16L10 10L16 8Z" />
      <path d="M12 3L13 5L11 5L12 3Z" />
    </svg>
  );
}

export function IconChallengeWinner(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <path d="M8 2H16V10C16 13.3 14.2 16 12 16C9.8 16 8 13.3 8 10V2Z" />
      <path d="M8 5H5C4 5 3 6 3 7C3 9 4 10 6 10H8" />
      <path d="M16 5H19C20 5 21 6 21 7C21 9 20 10 18 10H16" />
      <path d="M10 16V18H14V16" />
      <path d="M9 20H15" />
      <path d="M9 7C10 6 11 7 12 6C13 7 14 6 15 7" />
    </svg>
  );
}

export function IconCrewFounder(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <circle cx="8" cy="7" r="3" />
      <path d="M2 21V18C2 15.8 3.8 14 6 14H10C12.2 14 14 15.8 14 18V21" />
      <circle cx="16" cy="7" r="3" />
      <path d="M14 21V18C14 15.8 15.8 14 18 14H20C22.2 14 24 15.8 24 18V21" />
      <path d="M11 10C11 9.2 11.5 8.5 12 9C12.5 8.5 13 9.2 13 10C13 10.8 12.5 11.5 12 11C11.5 11.5 11 10.8 11 10Z" />
    </svg>
  );
}

export function IconTeamPlayer(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <circle cx="6" cy="8" r="2.5" />
      <path d="M1 21V18C1 16 2.5 14.5 4 14.5H8C9.5 14.5 11 16 11 18V21" />
      <circle cx="12" cy="6" r="3" />
      <path d="M7 21V18C7 15.5 9 13.5 12 13.5C15 13.5 17 15.5 17 18V21" />
      <circle cx="18" cy="8" r="2.5" />
      <path d="M16 21V18C16 16 17.5 14.5 19 14.5H22C23.5 14.5 25 16 25 18V21" />
    </svg>
  );
}

export function IconMilestoneMaster(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3V1M12 1L14 3L12 5L10 3L12 1Z" />
    </svg>
  );
}

export function IconHelpingHand(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <path d="M12 6C12 6 9 3 7 3C5 3 3.5 4.5 3.5 6.5C3.5 9 12 14 12 14C12 14 20.5 9 20.5 6.5C20.5 4.5 19 3 17 3C15 3 12 6 12 6Z" />
      <path d="M4 16L8 20L12 16" />
      <path d="M20 16L16 20L12 16" />
    </svg>
  );
}

export function IconConversationStarter(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <path d="M3 4H21V16H13L8 20V16H3V4Z" />
      <circle cx="8" cy="10" r="1" />
      <circle cx="12" cy="10" r="1" />
      <circle cx="16" cy="10" r="1" />
      <path d="M18 6L19 5M18 6L19 7M18 6L17 5" />
    </svg>
  );
}

export function IconRoleFiller(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <path d="M4 4H20V16L12 22L4 16V4Z" />
      <path d="M8 11L11 14L16 8" />
    </svg>
  );
}

export function IconFirstSession(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9H21" />
      <path d="M8 2V5" />
      <path d="M16 2V5" />
      <path d="M10 13L10 17L14 15L10 13Z" />
    </svg>
  );
}

export function IconSessionTeacher(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 17V21" />
      <path d="M16 17V21" />
      <circle cx="12" cy="9" r="2" />
      <path d="M8 14C8 14 9.5 12 12 12C14.5 12 16 14 16 14" />
    </svg>
  );
}

export function IconStreak4Weeks(props: IconProps) {
  return (
    <svg {...svgBase} {...props}>
      <path d="M12 2C12 2 6 8 6 13C6 16.3 8.7 19 12 19C15.3 19 18 16.3 18 13C18 8 12 2 12 2Z" />
      <path d="M10 13C10 11.9 10.9 11 12 11C13.1 11 14 11.9 14 13C14 14.1 13.1 15 12 15C10.9 15 10 14.1 10 13Z" />
      <path d="M8 14C8 12 9.8 10 12 10C14.2 10 16 12 16 14" />
      <path d="M7 15C7 12.5 9.2 9 12 9C14.8 9 17 12.5 17 15" />
      <path d="M6 16C6 13 8.5 8 12 8C15.5 8 18 13 18 16" />
    </svg>
  );
}

export const ACHIEVEMENT_ICONS: Record<string, React.ComponentType<IconProps>> = {
  first_project: IconFirstProject,
  first_milestone: IconFirstMilestone,
  first_endorsement: IconFirstEndorsement,
  five_endorsements: IconFiveEndorsements,
  ten_endorsements: IconTenEndorsements,
  community_recognized: IconCommunityRecognized,
  mentor: IconMentor,
  collaborator: IconCollaborator,
  prolific_teacher: IconProlificTeacher,
  project_builder: IconProjectBuilder,
  community_builder: IconCommunityBuilder,
  reliable_collaborator: IconReliableCollaborator,
  helped_ten_people: IconHelpedTenPeople,
  learner_journey: IconLearnerJourney,
  challenge_winner: IconChallengeWinner,
  crew_founder: IconCrewFounder,
  team_player: IconTeamPlayer,
  milestone_master: IconMilestoneMaster,
  helping_hand: IconHelpingHand,
  conversation_starter: IconConversationStarter,
  role_filler: IconRoleFiller,
  first_session: IconFirstSession,
  session_teacher: IconSessionTeacher,
  streak_4_weeks: IconStreak4Weeks,
};
