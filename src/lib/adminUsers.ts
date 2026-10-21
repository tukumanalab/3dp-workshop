export const isValidEmail = (s: string): boolean => s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export function serializeAdminUser(u: {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  googleSub: string | null;
  createdAt: Date;
  _count: { workshops: number; projects: number };
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    hasGoogle: !!u.googleSub,
    createdAt: u.createdAt,
    workshopCount: u._count.workshops,
    projectCount: u._count.projects,
  };
}
