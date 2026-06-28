import type { Request, Response } from "express";

export interface User {
  id: number;
  name: string;
}

export function listUsers(): User[] {
  return [];
}

export function getUsers(_req: Request, res: Response): void {
  res.json(listUsers());
}
