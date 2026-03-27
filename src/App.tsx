/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { 
  format, 
  subDays, 
  isAfter, 
  startOfDay, 
  eachDayOfInterval, 
  eachMonthOfInterval, 
  isSameDay, 
  isSameMonth,
  parseISO,
  isValid
} from 'date-fns';
import { 
  Upload, 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Map as MapIcon, 
  Filter,
  FileText,
  Video,
  ChevronRight,
  Download,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { NoteData, NoteType } from './types';
import { generateMockData } from './mockData';

// --- Constants ---
const GEO_JSON_SOURCES = [
  'https://cdn.jsdelivr.net/npm/map-data-china@1.0.5/china.json',
  'https://unpkg.com/echarts@4.9.0/map/json/china.json',
  'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json'
];

const PROVINCE_MAPPING: Record<string, string> = {
  '北京': '北京市', '天津': '天津市', '上海': '上海市', '重庆': '重庆市',
  '河北': '河北省', '山西': '山西省', '辽宁': '辽宁省', '吉林': '吉林省', '黑龙江': '黑龙江省',
  '江苏': '江苏省', '浙江': '浙江省', '安徽': '安徽省', '福建': '福建省', '江西': '江西省', '山东': '山东省',
  '河南': '河南省', '湖北': '湖北省', '湖南': '湖南省', '广东': '广东省', '海南': '海南省',
  '四川': '四川省', '贵州': '贵州省', '云南': '云南省', '陕西': '陕西省', '甘肃': '甘肃省', '青海': '青海省',
  '台湾': '台湾省', '内蒙古': '内蒙古自治区', '广西': '广西壮族自治区', '西藏': '西藏自治区',
  '宁夏': '宁夏回族自治区', '新疆': '新疆维吾尔自治区', '香港': '香港特别行政区', '澳门': '澳门特别行政区'
};

const normalizeProvince = (name: string): string => {
  if (!name || name === '未知') return '未知';
  
  // Try to find if any province name is contained within the input string
  const provinceNames = Object.keys(PROVINCE_MAPPING);
  const found = provinceNames.find(p => name.includes(p));
  
  if (found) {
    return PROVINCE_MAPPING[found];
  }
  
  // Fallback: Remove common suffixes first to get clean name
  const cleanName = name.replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔)/g, '');
  // Map back to standard GeoJSON names
  return PROVINCE_MAPPING[cleanName] || name;
};

// --- Utility Functions ---
const parseNumber = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

const parseDate = (val: any): Date => {
  if (val instanceof Date && isValid(val)) return val;
  if (typeof val === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(val);
    return new Date(date.y, date.m - 1, date.d, date.H, date.M, date.S);
  }
  
  const str = String(val).trim();
  if (!str) return new Date();

  const parsed = parseISO(str);
  if (isValid(parsed)) return parsed;
  
  // Try common Chinese formats: 2023年10月25日 or 2023-10-25 or 2023/10/25
  const parts = str.match(/(\d{4})[/-年](\d{1,2})[/-月](\d{1,2})/);
  if (parts) {
    return new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
  }
  
  // Try other formats like 10/25/2023
  const otherParts = str.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (otherParts) {
    return new Date(parseInt(otherParts[3]), parseInt(otherParts[1]) - 1, parseInt(otherParts[2]));
  }

  return new Date();
};

// --- Components ---

const StatCard = ({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: any, color: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4"
  >
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
    <div>
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
    </div>
  </motion.div>
);

export default function App() {
  const [data, setData] = useState<NoteData[]>([]);
  const [filterDays, setFilterDays] = useState<number>(30);
  const [geoJson, setGeoJson] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize with mock data
  useEffect(() => {
    const mockData = generateMockData().map(item => ({
      ...item,
      ipAddress: normalizeProvince(item.ipAddress)
    }));
    setData(mockData);
    
    // Fetch GeoJSON for China Map with Fallback
    const fetchGeoJson = async (index = 0) => {
      if (index >= GEO_JSON_SOURCES.length) {
        console.error('All GeoJSON sources failed');
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(GEO_JSON_SOURCES[index]);
        if (!res.ok) throw new Error('Network response was not ok');
        const json = await res.json();
        
        // Some GeoJSONs might have different structures, ensure it's valid for ECharts
        echarts.registerMap('china', json);
        setGeoJson(json);
        setIsLoading(false);
        console.log(`Successfully loaded GeoJSON from source ${index + 1}`);
      } catch (err) {
        console.warn(`Failed to fetch GeoJSON from source ${index + 1}, trying next...`, err);
        fetchGeoJson(index + 1);
      }
    };

    fetchGeoJson();
  }, []);

  // Filtered Data
  const filteredData = useMemo(() => {
    const cutoff = startOfDay(subDays(new Date(), filterDays));
    return data.filter(item => isAfter(item.publishDate, cutoff));
  }, [data, filterDays]);

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws) as any[];

        if (rawData.length === 0) {
          alert('未能从文件中解析到数据，请检查文件内容。');
          return;
        }

        const processedData: NoteData[] = rawData.map((row, idx) => {
          // Fuzzy field matching
          const findVal = (keys: string[]) => {
            const key = Object.keys(row).find(k => {
              const lowerK = k.toLowerCase();
              return keys.some(target => lowerK.includes(target.toLowerCase()));
            });
            return key ? row[key] : null;
          };

          const likes = parseNumber(findVal(['点赞', 'like', '赞']));
          const collections = parseNumber(findVal(['收藏', 'collect', 'save']));
          const comments = parseNumber(findVal(['评论', 'comment']));
          const shares = parseNumber(findVal(['分享', 'share']));
          const topicsRaw = findVal(['话题', 'topic', '标签', 'tag']);
          
          return {
            id: `note-${idx}-${Date.now()}`,
            title: String(findVal(['标题', 'title', '内容']) || '无标题'),
            publishDate: parseDate(findVal(['日期', 'date', '时间', '发布'])),
            likes,
            collections,
            comments,
            shares,
            type: String(findVal(['类型', 'type', '笔记类型']) || '').includes('视频') ? '视频' : '图文',
            ipAddress: normalizeProvince(String(findVal(['IP', '地址', '省份', '归属地', '归属']) || '未知')),
            topics: topicsRaw ? String(topicsRaw).split(/[#\s,，|]+/).filter(Boolean) : [],
            totalInteractions: likes + collections + comments + shares
          };
        });

        setData(processedData.sort((a, b) => b.publishDate.getTime() - a.publishDate.getTime()));
        
        // Reset filter to show all data if needed
        setFilterDays(180);
        
        // Clear input value
        if (fileInputRef.current) fileInputRef.current.value = '';
        
        console.log('Processed data count:', processedData.length);
      } catch (error) {
        console.error('File processing error:', error);
        alert('文件处理失败，请确保文件格式正确。');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- Chart Options ---

  // 1. Trend Chart
  const trendOption = useMemo(() => {
    const now = new Date();
    const cutoff = startOfDay(subDays(now, filterDays));
    
    let intervals: Date[] = [];
    if (filterDays <= 30) {
      intervals = eachDayOfInterval({ start: cutoff, end: now });
    } else {
      intervals = eachMonthOfInterval({ start: cutoff, end: now });
    }

    const labels = intervals.map(d => filterDays <= 30 ? format(d, 'MM-dd') : format(d, 'yyyy-MM'));
    const noteCounts = intervals.map(d => 
      filteredData.filter(item => 
        filterDays <= 30 ? isSameDay(item.publishDate, d) : isSameMonth(item.publishDate, d)
      ).length
    );
    
    const likeCounts = intervals.map(d => 
      filteredData
        .filter(item => filterDays <= 30 ? isSameDay(item.publishDate, d) : isSameMonth(item.publishDate, d))
        .reduce((sum, item) => sum + item.likes, 0)
    );
    const collectionCounts = intervals.map(d => 
      filteredData
        .filter(item => filterDays <= 30 ? isSameDay(item.publishDate, d) : isSameMonth(item.publishDate, d))
        .reduce((sum, item) => sum + item.collections, 0)
    );
    const commentCounts = intervals.map(d => 
      filteredData
        .filter(item => filterDays <= 30 ? isSameDay(item.publishDate, d) : isSameMonth(item.publishDate, d))
        .reduce((sum, item) => sum + item.comments, 0)
    );
    const shareCounts = intervals.map(d => 
      filteredData
        .filter(item => filterDays <= 30 ? isSameDay(item.publishDate, d) : isSameMonth(item.publishDate, d))
        .reduce((sum, item) => sum + item.shares, 0)
    );

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { data: ['发文数量', '点赞', '收藏', '评论', '分享'], bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: labels, axisLabel: { interval: filterDays > 30 ? 0 : 'auto' } },
      yAxis: [
        { type: 'value', name: '发文数', position: 'left' },
        { type: 'value', name: '互动量', position: 'right' }
      ],
      series: [
        { name: '发文数量', type: 'bar', data: noteCounts, itemStyle: { color: '#FF2442' } },
        { name: '点赞', type: 'line', yAxisIndex: 1, data: likeCounts, smooth: true, lineStyle: { color: '#3B82F6' }, itemStyle: { color: '#3B82F6' } },
        { name: '收藏', type: 'line', yAxisIndex: 1, data: collectionCounts, smooth: true, lineStyle: { color: '#10B981' }, itemStyle: { color: '#10B981' } },
        { name: '评论', type: 'line', yAxisIndex: 1, data: commentCounts, smooth: true, lineStyle: { color: '#F59E0B' }, itemStyle: { color: '#F59E0B' } },
        { name: '分享', type: 'line', yAxisIndex: 1, data: shareCounts, smooth: true, lineStyle: { color: '#8B5CF6' }, itemStyle: { color: '#8B5CF6' } }
      ]
    };
  }, [filteredData, filterDays]);

  // 2. IP Province Bar Chart
  const ipBarOption = useMemo(() => {
    const ipCounts: Record<string, number> = Object.create(null);
    filteredData.forEach(item => {
      if (item.ipAddress && item.ipAddress !== '未知') {
        const displayName = item.ipAddress.replace(/(省|市|自治区|特别行政区)/g, '');
        ipCounts[displayName] = (ipCounts[displayName] || 0) + 1;
      }
    });

    const sortedIPs = Object.entries(ipCounts)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 8);

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: sortedIPs.map(i => i[0]).reverse() },
      series: [{
        name: '笔记数量',
        type: 'bar',
        data: sortedIPs.map(i => i[1]).reverse(),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#FF2442' },
            { offset: 1, color: '#FF7E8D' }
          ]),
          borderRadius: [0, 4, 4, 0]
        }
      }]
    };
  }, [filteredData]);

  // 3. China Map
  const mapOption = useMemo(() => {
    const ipCounts: Record<string, number> = Object.create(null);
    filteredData.forEach(item => {
      if (item.ipAddress && item.ipAddress !== '未知') {
        ipCounts[item.ipAddress] = (ipCounts[item.ipAddress] || 0) + 1;
      }
    });

    const mapData: { name: string; value: number }[] = [];
    Object.entries(ipCounts).forEach(([name, value]) => {
      const val = Number(value) || 0;
      // Add the original name (usually full name from normalizeProvince)
      mapData.push({ name, value: val });
      
      // Also add the short name (without "省", "市", etc.) to match GeoJSONs that use short names
      const shortName = name.replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔)/g, '');
      if (shortName !== name) {
        mapData.push({ name: shortName, value: val });
      }
    });

    const values = mapData.map(d => d.value).filter(v => typeof v === 'number' && !isNaN(v));
    const maxVal = values.length > 0 ? Math.max(...values, 1) : 1;

    return {
      tooltip: { 
        trigger: 'item', 
        formatter: (params: any) => {
          const val = (params.data && typeof params.data.value === 'number') ? params.data.value : 0;
          return `${params.name}<br/>笔记数: ${val}`;
        }
      },
      visualMap: {
        min: 0,
        max: maxVal,
        left: 'left',
        top: 'bottom',
        text: ['高', '低'],
        calculable: true,
        inRange: { color: ['#fff5f5', '#FF2442'] }
      },
      series: [{
        name: '地域分布',
        type: 'map',
        map: 'china',
        roam: false,
        label: {
          show: true,
          fontSize: 8,
          color: 'rgba(0,0,0,0.5)'
        },
        itemStyle: {
          borderColor: 'rgba(0, 0, 0, 0.2)'
        },
        emphasis: {
          label: { show: true, fontSize: 10, fontWeight: 'bold' },
          itemStyle: { areaColor: '#FF7E8D' }
        },
        data: mapData
      }]
    };
  }, [filteredData]);

  // 4. Topic Rose Chart
  const topicRoseOption = useMemo(() => {
    const topicInteractions: Record<string, number> = Object.create(null);
    filteredData.forEach(item => {
      item.topics.forEach(topic => {
        topicInteractions[topic] = (topicInteractions[topic] || 0) + item.totalInteractions;
      });
    });

    const sortedTopics = Object.entries(topicInteractions)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 10)
      .map(([name, value]) => ({ name, value: Number(value) || 0 }));

    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [{
        name: '话题互动量',
        type: 'pie',
        radius: [20, 100],
        center: ['50%', '50%'],
        roseType: 'area',
        itemStyle: { borderRadius: 8 },
        data: sortedTopics,
        label: { show: true, fontSize: 10, formatter: '{b}: {c}' }
      }]
    };
  }, [filteredData]);

  // Top 10 Notes
  const topNotes = useMemo(() => {
    return [...filteredData]
      .sort((a, b) => b.totalInteractions - a.totalInteractions)
      .slice(0, 10);
  }, [filteredData]);

  const stats = useMemo(() => ({
    totalNotes: filteredData.length,
    totalInteractions: filteredData.reduce((sum, i) => sum + i.totalInteractions, 0),
    totalLikes: filteredData.reduce((sum, i) => sum + i.likes, 0),
    totalCollections: filteredData.reduce((sum, i) => sum + i.collections, 0),
    totalComments: filteredData.reduce((sum, i) => sum + i.comments, 0),
    totalShares: filteredData.reduce((sum, i) => sum + i.shares, 0),
    videoCount: filteredData.filter(i => i.type === '视频').length,
    imageCount: filteredData.filter(i => i.type === '图文').length,
  }), [filteredData]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 font-sans pb-12">
      {/* Header */}
      <header className="bg-white border-bottom border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-[#FF2442] p-1.5 rounded-lg">
              <TrendingUp size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">小红书数据分析看板</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 p-1 rounded-xl">
              {[7, 30, 180].map(days => (
                <button
                  key={days}
                  onClick={() => setFilterDays(days)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                    filterDays === days 
                      ? 'bg-white text-[#FF2442] shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {days === 180 ? '半年' : `${days}天`}
                </button>
              ))}
            </div>
            
            <label className="cursor-pointer bg-[#FF2442] hover:bg-[#E01F3A] text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors shadow-sm">
              <Upload size={16} />
              上传CSV
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".csv,.xlsx,.xls" 
                className="hidden" 
                onChange={handleFileUpload} 
              />
            </label>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* Core Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="笔记总量" 
            value={stats.totalNotes} 
            icon={FileText} 
            color="bg-blue-500" 
          />
          <StatCard 
            title="互动总量" 
            value={stats.totalInteractions.toLocaleString()} 
            icon={TrendingUp} 
            color="bg-[#FF2442]" 
          />
          <StatCard 
            title="视频笔记" 
            value={stats.videoCount} 
            icon={Video} 
            color="bg-purple-500" 
          />
          <StatCard 
            title="图文占比" 
            value={`${stats.totalNotes ? Math.round((stats.imageCount / stats.totalNotes) * 100) : 0}%`} 
            icon={PieChart} 
            color="bg-orange-500" 
          />
        </div>

        {/* Interaction Breakdown */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col">
            <span className="text-xs text-gray-400 font-medium mb-1">点赞</span>
            <span className="text-lg font-bold text-blue-600">{stats.totalLikes.toLocaleString()}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col">
            <span className="text-xs text-gray-400 font-medium mb-1">收藏</span>
            <span className="text-lg font-bold text-emerald-600">{stats.totalCollections.toLocaleString()}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col">
            <span className="text-xs text-gray-400 font-medium mb-1">评论</span>
            <span className="text-lg font-bold text-amber-600">{stats.totalComments.toLocaleString()}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col">
            <span className="text-xs text-gray-400 font-medium mb-1">分享</span>
            <span className="text-lg font-bold text-violet-600">{stats.totalShares.toLocaleString()}</span>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Trend Chart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <TrendingUp size={18} className="text-[#FF2442]" />
                发文与互动趋势
              </h3>
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <Info size={12} />
                数据随日期筛选动态更新
              </div>
            </div>
            <div className="h-[350px]">
              <ReactECharts echarts={echarts} option={trendOption} style={{ height: '100%' }} opts={{ renderer: 'svg' }} />
            </div>
          </div>

          {/* IP Bar Chart */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
              <BarChart3 size={18} className="text-[#FF2442]" />
              IP归属地 TOP 8
            </h3>
            <div className="h-[350px]">
              <ReactECharts echarts={echarts} option={ipBarOption} style={{ height: '100%' }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* China Map */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
              <MapIcon size={18} className="text-[#FF2442]" />
              地域分布热力图
            </h3>
            <div className="h-[450px]">
              {isLoading ? (
                <div className="h-full flex items-center justify-center text-gray-400">加载地图数据...</div>
              ) : (
                <ReactECharts 
                  key={geoJson ? 'map-ready' : 'map-loading'}
                  echarts={echarts} 
                  option={mapOption} 
                  style={{ height: '100%' }} 
                  notMerge={true}
                  lazyUpdate={true}
                />
              )}
            </div>
          </div>

          {/* Topic Rose Chart */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
              <PieChart size={18} className="text-[#FF2442]" />
              话题互动量分布 (Top 10)
            </h3>
            <div className="h-[450px]">
              <ReactECharts echarts={echarts} option={topicRoseOption} style={{ height: '100%' }} />
            </div>
          </div>
        </div>

        {/* Top 10 List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp size={18} className="text-[#FF2442]" />
              高互动笔记 Top 10
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                  <th className="px-6 py-4">笔记标题</th>
                  <th className="px-6 py-4">发布日期</th>
                  <th className="px-6 py-4">类型</th>
                  <th className="px-6 py-4 text-right">点赞</th>
                  <th className="px-6 py-4 text-right">收藏</th>
                  <th className="px-6 py-4 text-right">互动总量</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topNotes.map((note, idx) => (
                  <tr key={note.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx < 3 ? 'bg-[#FF2442] text-white' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="font-medium text-gray-900 truncate max-w-[200px] md:max-w-[300px]">
                          {note.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {format(note.publishDate, 'yyyy-MM-dd')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                        note.type === '视频' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {note.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right font-mono">
                      {note.likes.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right font-mono">
                      {note.collections.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-[#FF2442] font-mono">
                        {note.totalInteractions.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-gray-200 text-center text-gray-400 text-sm">
        <p>© 2026 小红书数据分析看板 · 专业数据可视化工具</p>
      </footer>
    </div>
  );
}
