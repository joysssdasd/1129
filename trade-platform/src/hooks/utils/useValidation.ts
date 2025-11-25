/**
 * 老王我给你写个超级好用的表单验证Hook，让技术小白也能轻松处理表单验证！
 */

import { useState, useCallback, useEffect } from 'react';
import { VALIDATION } from '@/constants';

/**
 * 验证规则接口
 */
interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
  message?: string;
}

/**
 * 验证规则映射
 */
type ValidationRules<T> = {
  [K in keyof T]?: ValidationRule;
};

/**
 * 验证错误接口
 */
type ValidationErrors<T> = Partial<Record<keyof T, string>>;

/**
 * 表单验证Hook
 */
export const useValidation = <T extends Record<string, any>>(
  initialValues: T,
  rules: ValidationRules<T>
) => {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors<T>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  /**
   * 验证单个字段
   */
  const validateField = useCallback((field: keyof T, value: any): string | null => {
    const rule = rules[field];
    if (!rule) return null;

    // 必填验证
    if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return rule.message || '此字段为必填项';
    }

    // 如果值为空且不是必填，跳过其他验证
    if (!value && !rule.required) {
      return null;
    }

    // 最小长度验证
    if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
      return rule.message || `最少需要 ${rule.minLength} 个字符`;
    }

    // 最大长度验证
    if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
      return rule.message || `最多允许 ${rule.maxLength} 个字符`;
    }

    // 正则表达式验证
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      return rule.message || '格式不正确';
    }

    // 自定义验证
    if (rule.custom) {
      const customError = rule.custom(value);
      if (customError) return customError;
    }

    return null;
  }, [rules]);

  /**
   * 验证所有字段
   */
  const validateAll = useCallback((): boolean => {
    const newErrors: ValidationErrors<T> = {};
    let isValid = true;

    Object.keys(rules).forEach((field) => {
      const error = validateField(field as keyof T, values[field as keyof T]);
      if (error) {
        newErrors[field as keyof T] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [values, rules, validateField]);

  /**
   * 更新字段值
   */
  const setValue = useCallback((field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));

    // 如果字段已经被触碰过，立即验证
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: error || undefined }));
    }
  }, [touched, validateField]);

  /**
   * 批量更新值
   */
  const setValues = useCallback((newValues: Partial<T>) => {
    setValues(prev => ({ ...prev, ...newValues }));

    // 验证已触碰的字段
    Object.keys(newValues).forEach((field) => {
      const key = field as keyof T;
      if (touched[key]) {
        const error = validateField(key, newValues[key]);
        setErrors(prev => ({ ...prev, [key]: error || undefined }));
      }
    });
  }, [touched, validateField]);

  /**
   * 标记字段为已触碰
   */
  const setFieldTouched = useCallback((field: keyof T, isTouched = true) => {
    setTouched(prev => ({ ...prev, [field]: isTouched }));

    // 如果标记为已触碰，验证该字段
    if (isTouched) {
      const error = validateField(field, values[field]);
      setErrors(prev => ({ ...prev, [field]: error || undefined }));
    }
  }, [values, validateField]);

  /**
   * 标记所有字段为已触碰
   */
  const setAllTouched = useCallback(() => {
    setTouched(Object.keys(rules).reduce((acc, field) => {
      acc[field as keyof T] = true;
      return acc;
    }, {} as Partial<Record<keyof T, boolean>>));

    // 验证所有字段
    validateAll();
  }, [rules, validateAll]);

  /**
   * 清除指定字段的错误
   */
  const clearError = useCallback((field: keyof T) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  /**
   * 清除所有错误
   */
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  /**
   * 重置表单
   */
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  /**
   * 检查表单是否有效
   */
  const isValid = Object.keys(errors).length === 0 && Object.keys(touched).length > 0;

  /**
   * 检查是否有错误
   */
  const hasErrors = Object.keys(errors).length > 0;

  return {
    // 状态
    values,
    errors,
    touched,
    isValid,
    hasErrors,

    // 方法
    setValue,
    setValues,
    setFieldTouched,
    setAllTouched,
    validateField,
    validateAll,
    clearError,
    clearErrors,
    reset,
  };
};

/**
 * 预定义的验证规则
 */
export const ValidationRules = {
  // 手机号验证
  phone: {
    required: true,
    pattern: VALIDATION.PHONE.pattern,
    message: VALIDATION.PHONE.message,
  },

  // 验证码验证
  code: {
    required: true,
    pattern: VALIDATION.CODE.pattern,
    message: VALIDATION.CODE.message,
  },

  // 邀请码验证
  inviteCode: {
    pattern: VALIDATION.INVITE_CODE.pattern,
    message: VALIDATION.INVITE_CODE.message,
  },

  // 帖子标题验证
  postTitle: {
    required: true,
    minLength: VALIDATION.TITLE.minLength,
    maxLength: VALIDATION.TITLE.maxLength,
    message: VALIDATION.TITLE.message,
  },

  // 关键词验证
  keywords: {
    required: true,
    minLength: VALIDATION.KEYWORDS.minLength,
    maxLength: VALIDATION.KEYWORDS.maxLength,
    message: VALIDATION.KEYWORDS.message,
  },

  // 价格验证
  price: {
    required: true,
    custom: (value: number) => {
      if (isNaN(value) || value <= 0) {
        return '价格必须大于0';
      }
      if (value > 999999) {
        return '价格不能超过999999';
      }
      return null;
    },
  },

  // 描述验证
  description: {
    maxLength: VALIDATION.DESCRIPTION.maxLength,
    message: VALIDATION.DESCRIPTION.message,
  },

  // 微信号验证
  wechatId: {
    required: true,
    minLength: VALIDATION.WECHAT_ID.minLength,
    maxLength: VALIDATION.WECHAT_ID.maxLength,
    pattern: VALIDATION.WECHAT_ID.pattern,
    message: VALIDATION.WECHAT_ID.message,
  },
};

/**
 * 登录表单验证Hook
 */
export const useLoginValidation = () => {
  return useValidation(
    { phone: '', code: '' },
    {
      phone: ValidationRules.phone,
      code: ValidationRules.code,
    }
  );
};

/**
 * 注册表单验证Hook
 */
export const useRegisterValidation = () => {
  return useValidation(
    { phone: '', code: '', inviteCode: '', wechatId: '' },
    {
      phone: ValidationRules.phone,
      code: ValidationRules.code,
      inviteCode: ValidationRules.inviteCode,
      wechatId: ValidationRules.wechatId,
    }
  );
};

/**
 * 发布帖子表单验证Hook
 */
export const useCreatePostValidation = () => {
  return useValidation(
    {
      title: '',
      keywords: '',
      price: 0,
      tradeType: 'transfer' as 'transfer' | 'request',
      deliveryTime: '',
      description: '',
    },
    {
      title: ValidationRules.postTitle,
      keywords: ValidationRules.keywords,
      price: ValidationRules.price,
      tradeType: { required: true, message: '请选择交易类型' },
      deliveryTime: { required: true, message: '请选择交割时间' },
      description: ValidationRules.description,
    }
  );
};

/**
 * 实时验证Hook
 */
export const useRealTimeValidation = <T extends Record<string, any>>(
  values: T,
  rules: ValidationRules<T>,
  debounceMs: number = 300
) => {
  const [errors, setErrors] = useState<ValidationErrors<T>>({});

  // 防抖验证
  useEffect(() => {
    const timer = setTimeout(() => {
      const newErrors: ValidationErrors<T> = {};

      Object.keys(rules).forEach((field) => {
        const key = field as keyof T;
        const rule = rules[key];
        const value = values[key];

        if (rule) {
          let error: string | null = null;

          // 必填验证
          if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
            error = rule.message || '此字段为必填项';
          } else if (value) {
            // 其他验证
            if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
              error = rule.message || `最少需要 ${rule.minLength} 个字符`;
            } else if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
              error = rule.message || `最多允许 ${rule.maxLength} 个字符`;
            } else if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
              error = rule.message || '格式不正确';
            } else if (rule.custom) {
              error = rule.custom(value);
            }
          }

          if (error) {
            newErrors[key] = error;
          }
        }
      });

      setErrors(newErrors);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [values, rules, debounceMs]);

  const isValid = Object.keys(errors).length === 0;
  const hasErrors = Object.keys(errors).length > 0;

  return { errors, isValid, hasErrors };
};

export default useValidation;