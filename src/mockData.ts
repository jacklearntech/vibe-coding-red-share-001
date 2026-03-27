/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NoteData } from './types';
import { subDays, format } from 'date-fns';

const provinces = [
  '广东', '上海', '北京', '浙江', '江苏', '四川', '山东', '福建', 
  '湖北', '湖南', '河南', '安徽', '重庆', '陕西', '辽宁', '天津'
];

const topics = [
  '日常', '穿搭', '美食', '旅行', '好物分享', '摄影', '职场', '学习', 
  '生活感悟', '家居', '美妆', '运动', '数码', '情感', '萌宠'
];

export const generateMockData = (): NoteData[] => {
  const data: NoteData[] = [];
  const now = new Date();

  for (let i = 0; i < 20; i++) {
    const publishDate = subDays(now, Math.floor(Math.random() * 180));
    const likes = Math.floor(Math.random() * 5000);
    const collections = Math.floor(Math.random() * 3000);
    const comments = Math.floor(Math.random() * 500);
    const shares = Math.floor(Math.random() * 200);
    
    data.push({
      id: `note-${i}`,
      title: `小红书优质笔记标题示例 ${i + 1}`,
      content: `这是一篇关于${topics[Math.floor(Math.random() * topics.length)]}的小红书笔记内容示例。在这里分享一些心得体会和实用建议，希望对大家有所帮助！#${topics[Math.floor(Math.random() * topics.length)]} #生活方式`,
      author: `博主_${i + 1}`,
      imageUrl: `https://picsum.photos/seed/note-${i}/400/600`,
      publishDate,
      likes,
      collections,
      comments,
      shares,
      type: Math.random() > 0.4 ? '图文' : '视频',
      ipAddress: provinces[Math.floor(Math.random() * provinces.length)],
      topics: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => topics[Math.floor(Math.random() * topics.length)]),
      totalInteractions: likes + collections + comments + shares
    });
  }

  return data.sort((a, b) => b.publishDate.getTime() - a.publishDate.getTime());
};
