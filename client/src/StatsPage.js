import React, { useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import CalendarHeatmap from 'react-calendar-heatmap';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  calculateOverallStats,
  getDailyActivity,
  calculateLearningStreak,
  getStatsByPOS,
} from './utils/statsUtils';
import './StatsPage.css';

const StatsPage = () => {
  const { words } = useOutletContext();
  const navigate = useNavigate();

  const {
    overallStats,
    dailyActivity,
    streak,
    posStats,
    heatmapData,
    posChartData,
  } = useMemo(() => {
    const overall = calculateOverallStats(words);
    const activity = getDailyActivity(words);
    const streakData = calculateLearningStreak(activity);
    const pos = getStatsByPOS(words);

    const today = new Date();
    const oneYearAgo = new Date(new Date().setFullYear(today.getFullYear() - 1));
    const hData = Object.entries(activity).map(([date, count]) => ({
      date: new Date(date),
      count,
    }));

    const pData = Object.entries(pos)
      .map(([name, { learned, total }]) => ({ name, 학습한단어: learned, 남은단어: total - learned }))
      .sort((a, b) => b.학습한단어 - a.학습한단어);

    return {
      overallStats: overall,
      dailyActivity: activity,
      streak: streakData,
      posStats: pos,
      heatmapData: hData,
      posChartData: pData,
    };
  }, [words]);

  const getHeatmapClass = (value) => {
    if (!value || value.count === 0) return 'color-empty';
    if (value.count > 15) return 'color-scale-4';
    if (value.count > 10) return 'color-scale-3';
    if (value.count > 5) return 'color-scale-2';
    return 'color-scale-1';
  };

  return (
    <div className="stats-page">
      <div className="stats-header">
        <h1>학습 통계</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <p className="value">{overallStats.learnedWords}</p>
          <p className="label">총 학습 단어</p>
        </div>
        <div className="stat-card">
          <p className="value">{overallStats.progressPercentage}%</p>
          <p className="label">전체 진도율</p>
        </div>
        <div className="stat-card">
          <p className="value">{streak.currentStreak}</p>
          <p className="label">현재 연속 학습</p>
        </div>
        <div className="stat-card">
          <p className="value">{streak.longestStreak}</p>
          <p className="label">최장 연속 학습</p>
        </div>
      </div>

      <div className="stats-section">
        <h2>학습 활동 (지난 1년)</h2>
        <CalendarHeatmap
          startDate={new Date(new Date().setFullYear(new Date().getFullYear() - 1))}
          endDate={new Date()}
          values={heatmapData}
          classForValue={getHeatmapClass}
          tooltipDataAttrs={value => ({ 'data-tip': `${value.date ? new Date(value.date).toLocaleDateString() : ''}: ${value.count || 0}개 학습` })}
        />
      </div>

      <div className="stats-section">
        <h2>품사별 학습 현황</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={posChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={100} />
            <Tooltip cursor={{fill: 'rgba(255, 255, 255, 0.1)'}} contentStyle={{backgroundColor: '#222', border: '1px solid #444'}}/>
            <Legend />
            <Bar dataKey="학습한단어" stackId="a" fill="#4FC3F7" />
            <Bar dataKey="남은단어" stackId="a" fill="#333" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatsPage;
