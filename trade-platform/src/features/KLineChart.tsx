// K-line Chart Component for Price Analytics
import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { supabase } from '../services/supabase';
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
                text: `价格走势分析${selectedKeyword ? ': ' + selectedKeyword : ''}`,
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
                            <div>开盘价: ¥${data.open.toFixed(2)}</div>
                            <div>收盘价: ¥${data.close.toFixed(2)}</div>
                            <div>最高价: ¥${data.high.toFixed(2)}</div>
                            <div>最低价: ¥${data.low.toFixed(2)}</div>
                            <div>平均价: ¥${data.avg.toFixed(2)}</div>
                            <div>信息数量: ${data.volume}</div>
                        </div>
                    `;
                }
            },
            legend: {
                data: ['K线图', '成交量'],
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
                    name: 'K线图',
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
                    name: '成交量',
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
        const headers = ['日期', '开盘价', '收盘价', '最高价', '最低价', '平均价', '信息数量'];
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
        link.download = `价格分析_${selectedKeyword || '全部'}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-4 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-4 items-center">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            关键词
                        </label>
                        <select
                            value={selectedKeyword}
                            onChange={(e) => setSelectedKeyword(e.target.value)}
                            className="border border-gray-300 rounded px-3 py-2 text-sm"
                        >
                            <option value="">全部关键词</option>
                            {availableKeywords.map(kw => (
                                <option key={kw} value={kw}>{kw}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            时间范围
                        </label>
                        <select
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                            className="border border-gray-300 rounded px-3 py-2 text-sm"
                        >
                            <option value={7}>最近7天</option>
                            <option value={30}>最近30天</option>
                            <option value={90}>最近90天</option>
                            <option value={180}>最近180天</option>
                        </select>
                    </div>
                </div>

                <button
                    onClick={exportToCSV}
                    disabled={chartData.length === 0}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                    <Download className="w-4 h-4" />
                    导出CSV
                </button>
            </div>

            {loading ? (
                <div className="h-[600px] flex items-center justify-center">
                    <div className="text-gray-500">加载图表数据中...</div>
                </div>
            ) : chartData.length === 0 ? (
                <div className="h-[600px] flex flex-col items-center justify-center text-gray-500">
                    <TrendingUp className="w-16 h-16 mb-4 text-gray-300" />
                    <div>所选时间段暂无数据</div>
                </div>
            ) : (
                <div ref={chartRef} style={{ width: '100%', height: '600px' }} />
            )}

            {chartData.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded">
                        <div className="text-xs text-gray-600 mb-1">最新价格</div>
                        <div className="text-xl font-bold text-blue-600">
                            {chartData[chartData.length - 1]?.close.toFixed(2)}
                        </div>
                    </div>
                    <div className="bg-red-50 p-4 rounded">
                        <div className="text-xs text-gray-600 mb-1">最高价</div>
                        <div className="text-xl font-bold text-red-600">
                            {Math.max(...chartData.map(d => d.high)).toFixed(2)}
                        </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded">
                        <div className="text-xs text-gray-600 mb-1">最低价</div>
                        <div className="text-xl font-bold text-green-600">
                            {Math.min(...chartData.map(d => d.low)).toFixed(2)}
                        </div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded">
                        <div className="text-xs text-gray-600 mb-1">信息总数</div>
                        <div className="text-xl font-bold text-purple-600">
                            {chartData.reduce((sum, d) => sum + d.volume, 0)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
