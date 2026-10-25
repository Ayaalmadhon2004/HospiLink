export interface Ward {
  id: string;
  name: string;
  floor: number | null;
  /** Prisma relation count: beds currently in the ward (a ward with beds cannot be deleted). */
  _count?: { beds: number };
}
