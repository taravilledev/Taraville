export const projectOwnershipLabels = {
  all: "งานทั้งหมดที่ฉันเห็น",
  mine: "งานที่ฉันดูแล",
  others: "งานที่คนอื่นดูแล",
} as const;

export type ProjectOwnership = keyof typeof projectOwnershipLabels;

export function groupDashboardProjects<T extends { responsible_id: string }>(projects: T[], staffId: string) {
  const groups = { all: projects, mine: [] as T[], others: [] as T[] };
  for (const project of projects) {
    groups[project.responsible_id === staffId ? "mine" : "others"].push(project);
  }
  return groups;
}
