import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface Folder {
  id: number;
  name: string;
  parentId: number | null;
  createdAt: string;
  childCount: number;
}

export interface FolderListing {
  path: { id: number; name: string }[];
  folders: Folder[];
}

@Injectable({ providedIn: 'root' })
export class FolderService {
  private http = inject(HttpClient);
  private base = 'api/folders';

  list(parentId: number | null) {
    return this.http.get<FolderListing>(this.base, {
      params: parentId === null ? {} : { parentId },
    });
  }
  create(name: string, parentId: number | null) {
    return this.http.post<Folder>(this.base, { name, parentId });
  }
  rename(id: number, name: string) {
    return this.http.patch<Folder>(`${this.base}/${id}`, { name });
  }
  remove(id: number) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
