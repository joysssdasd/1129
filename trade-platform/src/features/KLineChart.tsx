// K-line Chart Component for Price Analytics
import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { supabase } from '../lib/supabase';
import { Download, TrendingUp, Calendar } from 'lucide-react';

interface KLineChartProps {
    keyword?: string;
    tradeType?: number;
}

export default function KLineChart({ keyword, tradeType }: KLineChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const [chartData, setChartData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [days, setDays] = useState(30);
    const [availableKeywords, setAvailableKeywords] = useState<string[]>([]);
    const [selectedKeyword, setSelectedKeyword] = useState(keyword || '');

    useEffect(() => {
        fetchChartData();
    }, [selectedKeyword, tradeType, days]);

    useEffect(() => {
        if (chartData.length > 0 && chartRef.current) {
            renderChart();
        }
    }, [chartData]);

    const fetchChartData = async () => {
        try {
            setLoading(true);
            
            let url = `get-keyword-analytics?days=${days}&mode=realtime`;
            if (selectedKeyword) {
                url += `&keyword=${encodeURIComponent(selectedKeyword)}`;
            }
            if (tradeType !== undefined) {
                url += `&trade_type=${tradeType}`;
            }

            const { data, error } = await supabase.functions.invoke(url);

            if (error) throw error;

            if (data?.data) {
                setChartData(data.data.chartData || []);
                setAvailableKeywords(data.data.availableKeywords || []);
            }
        } catch (error) {
            console.error('Failed to fetch chart data:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderChart = () => {
        if (!chartRef.current) return;

        const chart = echarts.init(chartRef.current);

        const dates = chartData.map(d => d.date);
        const values = chartData.map(d => [d.open, d.close, d.low, d.high]);
        const volumes = chartData.map(d => d.volume);

        const option = {
            title: {
                text: `Price Trend Analysis${selectedKeyword ? ': ' + selectedKeyword : ''}`,
                left: 'center',
                textStyle: {
                    fontSize: 18,
                    fontWeight: 'bold'
                }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross'
                },
                formatter: function(params: any) {
                    const dataIndex = params[0].dataIndex;
                    const data = chartData[dataIndex];
                    return `
                        <div style="padding: 10px;">
                            <div style="font-weight: bold; margin-bottom: 5px;">${data.date}</div>
                            <div>Open: ${data.open.toFixed(2)}</div>
                            <div>Close: ${data.close.toFixed(2)}</div>
                            <div>High: ${data.high.toFixed(2)}</div>
                            <div>Low: ${data.low.toFixed(2)}</div>
                            <div>Avg: ${data.avg.toFixed(2)}</div>
                            <div>Posts: ${data.volume}</div>
                        </div>
                    `;
                }
            },
            legend: {
                data: ['K-Line', 'Volume'],
                top: 35
            },
            grid: [
                {
                    left: '10%',
                    right: '10%',
                    top: '15%',
                    height: '50%'
                },
                {
                    left: '10%',
                    right: '10%',
                    top: '70%',
                    height: '15%'
                }
            ],
            xAxis: [
                {
                    type: 'category',
                    data: dates,
                    boundaryGap: true,
                    axisLine: { onZero: false },
                    splitLine: { show: false },
                    min: 'dataMin',
                    max: 'dataMax'
                },
                {
                    type: 'category',
                    gridIndex: 1,
                    data: dates,
                    boundaryGap: true,
                    axisLine: { onZero: false },
                    axisTick: { show: false },
                    splitLine: { show: false },
                    axisLabel: { show: false },
                    min: 'dataMin',
                    max: 'dataMax'
                }
            ],
            yAxis: [
                {
                    scale: true,
                    splitArea: {
                        show: true
                    }
                },
                {
                    scale: true,
                    gridIndex: 1,
                    splitNumber: 2,
                    axisLabel: { show: false },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: { show: false }
                }
            ],
            dataZoom: [
                {
                    type: 'inside',
                    xAxisIndex: [0, 1],
                    start: 0,
                    end: 100
                },
                {
                    show: true,
                    xAxisIndex: [0, 1],
                    type: 'slider',
                    bottom: '5%',
                    start: 0,
                    end: 100
                }
            ],
            series: [
                {
                    name: 'K-Line',
                    type: 'candlestick',
                    data: values,
                    itemStyle: {
                        color: '#ef4444',
                        color0: '#22c55e',
                        borderColor: '#ef4444',
                        borderColor0: '#22c55e'
                    }
                },
                {
                    name: 'Volume',
                    type: 'bar',
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: volumes,
                    itemStyle: {
                        color: function(params: any) {
                            const dataIndex = params.dataIndex;
                            const currentData = chartData[dataIndex];
                            return currentData.close >= currentData.open ? '#ef4444' : '#22c55e';
                        }
                    }
                }
            ]
        };

        chart.setOption(option);

        const resizeObserver = new ResizeObserver(() => {
            chart.resize();
        });

        resizeObserver.observe(chartRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.dispose();
        };
    };

    const exportToCSV = () => {
        const headers = ['Date', 'Open', 'Close', 'High', 'Low', 'Average', 'Volume'];
        const rows = chartData.map(d => [
            d.date,
            d.open.toFixed(2),
            d.close.toFixed(2),
            d.high.toFixed(2),
            d.low.toFixed(2),
            d.avg.toFixed(2),
            d.volume
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `price_analytics_${selectedKeyword || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-4 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-4 items-center">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Keyword
                        </label>
                        <select
                            value={selectedKeyword}
                            onChange={(e) => setSelectedKeyword(e.target.value)}
                            className="border border-gray-300 rounded px-3 py-2 text-sm"
                        >
                            <option value="">All Keywords</option>
                            {availableKeywords.map(kw => (
                                <option key={kw} value={kw}>{kw}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Time Range
                        </label>
                        <select
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                            className="border border-gray-300 rounded px-3 py-2 text-sm"
                        >
                            <option value={7}>Last 7 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={90}>Last 90 days</option>
                            <option value={180}>Last 180 days</option>
                        </select>
                    </div>
                </div>

                <button
                    onClick={exportToCSV}
                    disabled={chartData.length === 0}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            {loading ? (
                <div className="h-[600px] flex items-center justify-center">
                    <div className="text-gray-500">Loading chart data...</div>
                </div>
            ) : chartData.length === 0 ? (
                <div className="h-[600px] flex flex-col items-center justify-center text-gray-500">
                    <TrendingUp className="w-16 h-16 mb-4 text-gray-300" />
                    <div>No data available for the selected period</div>
                </div>
            ) : (
                <div ref={chartRef} style={{ width: '100%', height: '600px' }} />
            )}

            {chartData.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded">
                        <div className="text-xs text-gray-600 mb-1">Latest Price</div>
                        <div className="text-xl font-bold text-blue-600">
                            {chartData[chartData.length - 1]?.close.toFixed(2)}
                        </div>
                    </div>
                    <div className="bg-red-50 p-4 rounded">
                        <div className="text-xs text-gray-600 mb-1">Highest</div>
                        <div className="text-xl font-bold text-red-600">
                            {Math.max(...chartData.map(d => d.high)).toFixed(2)}
                        </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded">
                        <div className="text-xs text-gray-600 mb-1">Lowest</div>
                        <div className="text-xl font-bold text-green-600">
                            {Math.min(...chartData.map(d => d.low)).toFixed(2)}
                        </div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded">
                        <div className="text-xs text-gray-600 mb-1">Total Posts</div>
                        <div className="text-xl font-bold text-purple-600">
                            {chartData.reduce((sum, d) => sum + d.volume, 0)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
