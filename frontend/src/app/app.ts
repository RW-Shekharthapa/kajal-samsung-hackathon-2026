import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Folder, FolderService } from './folder.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private api = inject(FolderService);

  protected folders = signal<Folder[]>([]);
  protected path = signal<{ id: number; name: string }[]>([]);
  protected loading = signal(true);
  protected error = signal('');
  protected newName = '';
  protected editingId = signal<number | null>(null);
  protected editName = '';
  private currentId: number | null = null;

  constructor() {
    this.load(null);
  }

  protected load(parentId: number | null) {
    this.loading.set(true);
    this.error.set('');
    this.api.list(parentId).subscribe({
      next: (res) => {
        this.currentId = parentId;
        this.folders.set(res.folders);
        this.path.set(res.path);
        this.editingId.set(null);
        this.loading.set(false);
      },
      error: (e) => this.fail(e),
    });
  }

  protected create() {
    const name = this.newName.trim();
    if (!name) return this.error.set('Please enter a folder name');
    this.api.create(name, this.currentId).subscribe({
      next: () => { this.newName = ''; this.load(this.currentId); },
      error: (e) => this.fail(e),
    });
  }

  protected startEdit(f: Folder) {
    this.editingId.set(f.id);
    this.editName = f.name;
  }

  protected saveEdit(f: Folder) {
    const name = this.editName.trim();
    if (!name) return this.error.set('Please enter a folder name');
    if (name === f.name) return this.editingId.set(null);
    this.api.rename(f.id, name).subscribe({
      next: () => this.load(this.currentId),
      error: (e) => this.fail(e),
    });
  }

  protected remove(f: Folder) {
    const extra = f.childCount ? ` and its ${f.childCount} subfolder(s)` : '';
    if (!confirm(`Delete "${f.name}"${extra}?`)) return;
    this.api.remove(f.id).subscribe({
      next: () => this.load(this.currentId),
      error: (e) => this.fail(e),
    });
  }

  private fail(e: HttpErrorResponse) {
    this.loading.set(false);
    this.error.set(e.error?.error ?? 'Could not reach the server. Please try again.');
  }
}
