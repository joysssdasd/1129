/**
 * 老王我给你写个表单验证测试，让技术小白也能写测试！
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useValidation, ValidationRules, useLoginValidation } from './useValidation';

describe('useValidation', () => {
  let initialValues: { name: string; email: string; age: number };
  let rules: any;

  beforeEach(() => {
    initialValues = {
      name: '',
      email: '',
      age: 0,
    };

    rules = {
      name: {
        required: true,
        minLength: 2,
        maxLength: 50,
      },
      email: {
        required: true,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      },
      age: {
        required: true,
        custom: (value: number) => {
          if (value < 0) return '年龄不能小于0';
          if (value > 150) return '年龄不能大于150';
          return null;
        },
      },
    };
  });

  it('应该初始化为默认值', () => {
    const { result } = renderHook(() => useValidation(initialValues, rules));

    expect(result.current.values).toEqual(initialValues);
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
    expect(result.current.isValid).toBe(false);
    expect(result.current.hasErrors).toBe(false);
  });

  it('应该能够设置值', () => {
    const { result } = renderHook(() => useValidation(initialValues, rules));

    act(() => {
      result.current.setValue('name', '老王');
    });

    expect(result.current.values.name).toBe('老王');
  });

  it('应该验证必填字段', () => {
    const { result } = renderHook(() => useValidation(initialValues, rules));

    act(() => {
      result.current.setFieldTouched('name');
    });

    expect(result.current.errors.name).toBe('此字段为必填项');
  });

  it('应该验证最小长度', () => {
    const { result } = renderHook(() => useValidation(initialValues, rules));

    act(() => {
      result.current.setValue('name', 'a');
    });
    act(() => {
      result.current.setFieldTouched('name');
    });

    expect(result.current.errors.name).toBe('最少需要 2 个字符');
  });

  it('应该验证最大长度', () => {
    const { result } = renderHook(() => useValidation(initialValues, rules));

    const longName = 'a'.repeat(51);
    act(() => {
      result.current.setValue('name', longName);
    });
    act(() => {
      result.current.setFieldTouched('name');
    });

    expect(result.current.errors.name).toBe('最多允许 50 个字符');
  });

  it('应该验证正则表达式', () => {
    const { result } = renderHook(() => useValidation(initialValues, rules));

    act(() => {
      result.current.setValue('email', 'invalid-email');
    });
    act(() => {
      result.current.setFieldTouched('email');
    });

    expect(result.current.errors.email).toBe('格式不正确');
  });

  it('应该验证自定义规则', () => {
    const { result } = renderHook(() => useValidation(initialValues, rules));

    act(() => {
      result.current.setValue('age', -1);
    });
    act(() => {
      result.current.setFieldTouched('age');
    });

    expect(result.current.errors.age).toBe('年龄不能小于0');
  });

  it('应该能够批量设置值', () => {
    const { result } = renderHook(() => useValidation(initialValues, rules));

    act(() => {
      result.current.setValues({
        name: '老王',
        email: 'laowang@example.com',
        age: 30,
      });
    });

    expect(result.current.values).toEqual({
      name: '老王',
      email: 'laowang@example.com',
      age: 30,
    });
  });

  it('应该验证所有字段', () => {
    const { result } = renderHook(() => useValidation(initialValues, rules));

    act(() => {
      result.current.setValues({
        name: '老王',
        email: 'laowang@example.com',
        age: 30,
      });
    });

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateAll();
    });

    expect(isValid!).toBe(true);
    expect(result.current.hasErrors).toBe(false);
  });

  it('应该能够重置表单', () => {
    const { result } = renderHook(() => useValidation(initialValues, rules));

    act(() => {
      result.current.setValues({
        name: '老王',
        email: 'laowang@example.com',
        age: 30,
      });
      result.current.setAllTouched();
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.values).toEqual(initialValues);
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
  });

  it('应该能够清除错误', () => {
    const { result } = renderHook(() => useValidation(initialValues, rules));

    act(() => {
      result.current.setFieldTouched('name');
    });

    expect(result.current.errors.name).toBeDefined();

    act(() => {
      result.current.clearError('name');
    });

    expect(result.current.errors.name).toBeUndefined();
  });

  it('应该能够清除所有错误', () => {
    const { result } = renderHook(() => useValidation(initialValues, rules));

    act(() => {
      result.current.setAllTouched();
    });

    expect(result.current.hasErrors).toBe(true);

    act(() => {
      result.current.clearErrors();
    });

    expect(result.current.hasErrors).toBe(false);
  });
});

describe('useLoginValidation', () => {
  it('应该提供登录表单的验证规则', () => {
    const { result } = renderHook(() => useLoginValidation());

    expect(result.current.values).toEqual({
      phone: '',
      code: '',
    });

    expect(result.current.isValid).toBe(false);
  });

  it('应该验证手机号格式', () => {
    const { result } = renderHook(() => useLoginValidation());

    act(() => {
      result.current.setValue('phone', '123456789');
      result.current.setFieldTouched('phone');
    });

    expect(result.current.errors.phone).toBe('请输入正确的手机号码');
  });

  it('应该验证正确的手机号', () => {
    const { result } = renderHook(() => useLoginValidation());

    act(() => {
      result.current.setValue('phone', '13800138000');
    });
    act(() => {
      result.current.setFieldTouched('phone');
    });

    expect(result.current.errors.phone).toBeUndefined();
  });

  it('应该验证验证码格式', () => {
    const { result } = renderHook(() => useLoginValidation());

    act(() => {
      result.current.setValue('code', '12345');
    });
    act(() => {
      result.current.setFieldTouched('code');
    });

    expect(result.current.errors.code).toBe('验证码必须是6位数字');
  });

  it('应该验证正确的验证码', () => {
    const { result } = renderHook(() => useLoginValidation());

    act(() => {
      result.current.setValue('code', '123456');
    });
    act(() => {
      result.current.setFieldTouched('code');
    });

    expect(result.current.errors.code).toBeUndefined();
  });
});