/**
 * 老王我给你写个帖子相关的Hooks，让技术小白也能轻松管理帖子数据！
 */

import { useState, useEffect, useCallback } from 'react';
import { Post, PaginationParams, CreatePostData, PaginatedResponse } from '@/types';
import { PAGINATION } from '@/constants';
import { apiService } from '@/services/apiService';
import { useUser } from '@/contexts/UserContext';
import { toast } from '@/services/toastService';

/**
 * 帖子列表Hook
 */
export const usePosts = (initialParams?: Partial<PaginationParams>) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: PAGINATION.DEFAULT_PAGE,
    limit: PAGINATION.DEFAULT_LIMIT,
    total: 0,
    hasMore: true,
  });
  const [params, setParams] = useState<PaginationParams>({
    page: PAGINATION.DEFAULT_PAGE,
    limit: PAGINATION.DEFAULT_LIMIT,
    ...initialParams,
  });

  // 获取帖子列表
  const fetchPosts = useCallback(async (newParams?: Partial<PaginationParams>) => {
    setLoading(true);
    setError(null);

    try {
      const finalParams = { ...params, ...newParams };
      const response = await apiService.posts.getPosts(finalParams);

      if (newParams?.page && newParams.page > 1) {
        // 加载更多页面
        setPosts(prev => [...prev, ...response.data]);
      } else {
        // 替换列表（新搜索或第一页）
        setPosts(response.data);
      }

      setPagination({
        page: response.page as 1,
        limit: response.limit as 20,
        total: response.total,
        hasMore: response.hasMore,
      });

      setParams(finalParams);
    } catch (error) {
      setError('获取帖子列表失败');
      console.error('获取帖子列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [params]);

  // 搜索帖子
  const searchPosts = useCallback((search: string, tradeType?: 'transfer' | 'request') => {
    fetchPosts({
      search,
      trade_type: tradeType,
      page: 1, // 重置到第一页
    });
  }, [fetchPosts]);

  // 加载更多
  const loadMore = useCallback(() => {
    if (pagination.hasMore && !loading) {
      fetchPosts({
        page: pagination.page + 1,
      });
    }
  }, [fetchPosts, pagination.hasMore, pagination.page, loading]);

  // 刷新列表
  const refresh = useCallback(() => {
    fetchPosts({ page: 1 });
  }, [fetchPosts]);

  // 重置状态
  const reset = useCallback(() => {
    setPosts([]);
    setError(null);
    setPagination({
      page: PAGINATION.DEFAULT_PAGE,
      limit: PAGINATION.DEFAULT_LIMIT,
      total: 0,
      hasMore: true,
    });
    setParams({
      page: PAGINATION.DEFAULT_PAGE,
      limit: PAGINATION.DEFAULT_LIMIT,
      ...initialParams,
    });
  }, [initialParams]);

  // 初始加载
  useEffect(() => {
    fetchPosts();
  }, []); // 只在组件挂载时执行一次

  return {
    posts,
    loading,
    error,
    pagination,
    params,
    fetchPosts,
    searchPosts,
    loadMore,
    refresh,
    reset,
  };
};

/**
 * 单个帖子Hook
 */
export const usePost = (postId: string) => {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPost = useCallback(async () => {
    if (!postId) return;

    setLoading(true);
    setError(null);

    try {
      const postData = await apiService.posts.getPostDetail(postId);
      setPost(postData);
    } catch (error) {
      setError('获取帖子详情失败');
      console.error('获取帖子详情失败:', error);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  // 查看联系方式
  const viewContact = useCallback(async () => {
    if (!post || !postId) return;

    try {
      const contactInfo = await apiService.posts.viewContact(postId);
      toast.success('联系方式查看成功');
      return contactInfo;
    } catch (error) {
      console.error('查看联系方式失败:', error);
      throw error;
    }
  }, [post, postId]);

  // 确认交易
  const confirmDeal = useCallback(async (isCompleted: boolean) => {
    if (!postId) return;

    try {
      await apiService.posts.confirmDeal(postId, isCompleted);
      // 重新获取帖子信息
      await fetchPost();
    } catch (error) {
      console.error('确认交易失败:', error);
      throw error;
    }
  }, [postId, fetchPost]);

  // 下架帖子
  const deactivatePost = useCallback(async () => {
    if (!postId) return;

    try {
      await apiService.posts.deactivatePost(postId);
      // 重新获取帖子信息
      await fetchPost();
    } catch (error) {
      console.error('下架帖子失败:', error);
      throw error;
    }
  }, [postId, fetchPost]);

  // 初始加载
  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  return {
    post,
    loading,
    error,
    fetchPost,
    viewContact,
    confirmDeal,
    deactivatePost,
    canViewContact: post?.user_id !== post?.user?.id && post?.views_remaining > 0,
    isOwner: false, // TODO: 需要从用户状态判断
  };
};

/**
 * 发布帖子Hook
 */
export const useCreatePost = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, userPoints, deductPoints } = useUser();

  const createPost = useCallback(async (postData: CreatePostData) => {
    if (!user) {
      toast.error('请先登录');
      throw new Error('用户未登录');
    }

    if (userPoints < 10) {
      toast.error('积分不足，无法发布帖子');
      throw new Error('积分不足');
    }

    setLoading(true);
    setError(null);

    try {
      const newPost = await apiService.posts.createPost(postData);

      // 扣除积分
      const success = deductPoints(10, '发布帖子');
      if (!success) {
        throw new Error('积分扣除失败');
      }

      toast.success('帖子发布成功！');
      return newPost;
    } catch (error) {
      setError('发布帖子失败');
      console.error('发布帖子失败:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, userPoints, deductPoints]);

  return {
    createPost,
    loading,
    error,
    canPublish: userPoints >= 10,
  };
};

/**
 * 用户帖子管理Hook
 */
export const useUserPosts = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUser();

  const fetchUserPosts = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // 获取用户发布的帖子
      const response = await apiService.posts.getPosts({
        page: 1,
        limit: 100, // 获取所有用户的帖子
      });

      // 过滤出当前用户的帖子
      const userPosts = response.data.filter(post => post.user_id === user.id);
      setPosts(userPosts);
    } catch (error) {
      setError('获取用户帖子失败');
      console.error('获取用户帖子失败:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // 下架帖子
  const deactivatePost = useCallback(async (postId: string) => {
    try {
      await apiService.posts.deactivatePost(postId);
      // 从列表中移除
      setPosts(prev => prev.filter(post => post.id !== postId));
      toast.success('帖子已下架');
    } catch (error) {
      console.error('下架帖子失败:', error);
      throw error;
    }
  }, []);

  // 重新上架帖子
  const reactivatePost = useCallback(async (postId: string) => {
    // 这里需要实现重新上架的逻辑
    // 当前API没有提供重新上架的方法
    toast.info('重新上架功能待实现');
  }, []);

  // 初始加载
  useEffect(() => {
    fetchUserPosts();
  }, [fetchUserPosts]);

  return {
    posts,
    loading,
    error,
    fetchUserPosts,
    deactivatePost,
    reactivatePost,
  };
};