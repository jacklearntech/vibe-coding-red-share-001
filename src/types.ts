/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NoteType = '视频' | '图文';

export interface NoteData {
  id: string;
  title: string;
  content: string;
  author: string;
  imageUrl: string;
  publishDate: Date;
  likes: number;
  collections: number;
  comments: number;
  shares: number;
  type: NoteType;
  ipAddress: string;
  topics: string[];
  totalInteractions: number;
}

export interface DashboardStats {
  totalNotes: number;
  totalInteractions: number;
  videoCount: number;
  imageCount: number;
}
