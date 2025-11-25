/**
 * 老王我给你写个组件测试示例，让技术小白也能写组件测试！
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('应该渲染基础加载器', () => {
    render(<LoadingSpinner />);

    const spinner = screen.getByRole('status', { hidden: true });
    expect(spinner).toBeInTheDocument();
  });

  it('应该显示指定的文本', () => {
    render(<LoadingSpinner text="老王我正在加载中..." />);

    expect(screen.getByText('老王我正在加载中...')).toBeInTheDocument();
  });

  it('应该应用正确的尺寸类', () => {
    const { container } = render(<LoadingSpinner size="lg" />);

    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('h-8 w-8');
  });

  it('应该应用自定义className', () => {
    const { container } = render(<LoadingSpinner className="custom-class" />);

    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('应该支持不同的尺寸', () => {
    const { container: smallContainer } = render(<LoadingSpinner size="sm" />);
    const { container: mediumContainer } = render(<LoadingSpinner size="md" />);
    const { container: largeContainer } = render(<LoadingSpinner size="lg" />);

    expect(smallContainer.querySelector('svg')).toHaveClass('h-4 w-4');
    expect(mediumContainer.querySelector('svg')).toHaveClass('h-6 w-6');
    expect(largeContainer.querySelector('svg')).toHaveClass('h-8 w-8');
  });
});