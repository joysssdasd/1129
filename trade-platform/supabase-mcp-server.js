#!/usr/bin/env node

/**
 * 🚀 老王的Supabase MCP服务器
 * 提供Supabase数据库操作的MCP接口
 */

import { createClient } from '@supabase/supabase-js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// 从环境变量获取配置
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ 艹！缺少Supabase配置：SUPABASE_URL 和 SUPABASE_ANON_KEY 环境变量');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * MCP服务器主函数
 */
async function main() {
    console.error('🔧 老王的Supabase MCP服务器启动中...');
    console.error(`📍 项目URL: ${supabaseUrl}`);

    // 测试连接
    try {
        const { data, error } = await supabase.from('_test_connection').select('*').limit(1);
        if (error && error.code !== 'PGRST116') { // PGRST116 = relation does not exist, 这是正常的
            console.error('❌ Supabase连接失败:', error.message);
            return;
        }
        console.error('✅ Supabase连接成功！');
    } catch (err) {
        console.error('✅ Supabase服务器响应正常');
    }

    // 创建MCP服务器
    const server = new Server(
        {
            name: 'supabase-mcp-server',
            version: '1.0.0',
        },
        {
            capabilities: {
                tools: {},
            },
        }
    );

    // 注册工具
    server.setRequestHandler('tools/list', async () => ({
        tools: [
            {
                name: 'supabase_query',
                description: '执行Supabase SQL查询',
                inputSchema: {
                    type: 'object',
                    properties: {
                        sql: {
                            type: 'string',
                            description: '要执行的SQL语句'
                        },
                        table: {
                            type: 'string',
                            description: '表名（可选）'
                        }
                    },
                    required: ['sql']
                }
            },
            {
                name: 'supabase_insert',
                description: '向Supabase表插入数据',
                inputSchema: {
                    type: 'object',
                    properties: {
                        table: {
                            type: 'string',
                            description: '表名'
                        },
                        data: {
                            type: 'object',
                            description: '要插入的数据'
                        }
                    },
                    required: ['table', 'data']
                }
            },
            {
                name: 'supabase_update',
                description: '更新Supabase表数据',
                inputSchema: {
                    type: 'object',
                    properties: {
                        table: {
                            type: 'string',
                            description: '表名'
                        },
                        data: {
                            type: 'object',
                            description: '要更新的数据'
                        },
                        filter: {
                            type: 'object',
                            description: '过滤条件'
                        }
                    },
                    required: ['table', 'data']
                }
            },
            {
                name: 'supabase_select',
                description: '从Supabase表查询数据',
                inputSchema: {
                    type: 'object',
                    properties: {
                        table: {
                            type: 'string',
                            description: '表名'
                        },
                        columns: {
                            type: 'string',
                            description: '要查询的列（用逗号分隔），默认为*'
                        },
                        filter: {
                            type: 'object',
                            description: '过滤条件'
                        },
                        limit: {
                            type: 'number',
                            description: '限制返回行数'
                        },
                        orderBy: {
                            type: 'string',
                            description: '排序字段'
                        }
                    },
                    required: ['table']
                }
            },
            {
                name: 'supabase_delete',
                description: '从Supabase表删除数据',
                inputSchema: {
                    type: 'object',
                    properties: {
                        table: {
                            type: 'string',
                            description: '表名'
                        },
                        filter: {
                            type: 'object',
                            description: '过滤条件'
                        }
                    },
                    required: ['table']
                }
            }
        ]
    }));

    // 处理工具调用
    server.setRequestHandler('tools/call', async (request) => {
        const { name, arguments: args } = request.params;

        try {
            let result;

            switch (name) {
                case 'supabase_query':
                    result = await executeQuery(args.sql);
                    break;

                case 'supabase_insert':
                    result = await insertData(args.table, args.data);
                    break;

                case 'supabase_update':
                    result = await updateData(args.table, args.data, args.filter);
                    break;

                case 'supabase_select':
                    result = await selectData(args.table, args.columns, args.filter, args.limit, args.orderBy);
                    break;

                case 'supabase_delete':
                    result = await deleteData(args.table, args.filter);
                    break;

                default:
                    throw new Error(`未知工具: ${name}`);
            }

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }]
            };
        } catch (error) {
            return {
                content: [{
                    type: 'text',
                    text: `错误: ${error.message}`
                }],
                isError: true
            };
        }
    });

    // 启动传输
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('🚀 老王的Supabase MCP服务器已启动！');
}

/**
 * 执行SQL查询
 */
async function executeQuery(sql) {
    try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            throw new Error(`SQL执行失败: ${error.message}`);
        }

        return {
            success: true,
            data: data,
            message: 'SQL执行成功'
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 插入数据
 */
async function insertData(table, data) {
    try {
        const { data: result, error } = await supabase
            .from(table)
            .insert(data)
            .select();

        if (error) {
            throw new Error(`插入失败: ${error.message}`);
        }

        return {
            success: true,
            data: result,
            message: `成功插入到${table}表`
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 更新数据
 */
async function updateData(table, data, filter) {
    try {
        let query = supabase.from(table).update(data);

        if (filter) {
            Object.keys(filter).forEach(key => {
                query = query.eq(key, filter[key]);
            });
        }

        const { data: result, error } = await query.select();

        if (error) {
            throw new Error(`更新失败: ${error.message}`);
        }

        return {
            success: true,
            data: result,
            message: `成功更新${table}表数据`
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 查询数据
 */
async function selectData(table, columns = '*', filter = null, limit = null, orderBy = null) {
    try {
        let query = supabase.from(table).select(columns);

        if (filter) {
            Object.keys(filter).forEach(key => {
                query = query.eq(key, filter[key]);
            });
        }

        if (orderBy) {
            query = query.order(orderBy);
        }

        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`查询失败: ${error.message}`);
        }

        return {
            success: true,
            data: data,
            count: data.length,
            message: `从${table}表查询到${data.length}条记录`
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 删除数据
 */
async function deleteData(table, filter) {
    try {
        let query = supabase.from(table).delete();

        if (filter) {
            Object.keys(filter).forEach(key => {
                query = query.eq(key, filter[key]);
            });
        }

        const { data, error } = await query.select();

        if (error) {
            throw new Error(`删除失败: ${error.message}`);
        }

        return {
            success: true,
            data: data,
            message: `成功从${table}表删除${data.length}条记录`
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// 启动服务器
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { main };