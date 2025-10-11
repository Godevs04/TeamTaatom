import * as Yup from 'yup';

export const signUpSchema = Yup.object().shape({
  fullName: Yup.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .required('Full name is required'),
  email: Yup.string()
    .email('Please enter a valid email')
    .required('Email is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm password is required'),
});

export const signInSchema = Yup.object().shape({
  email: Yup.string()
    .email('Please enter a valid email')
    .required('Email is required'),
  password: Yup.string()
    .required('Password is required'),
});

export const forgotPasswordSchema = Yup.object().shape({
  email: Yup.string()
    .email('Please enter a valid email')
    .required('Email is required'),
});

export const postSchema = Yup.object().shape({
  comment: Yup.string()
    .max(500, 'Comment must be less than 500 characters')
    .required('Comment is required'),
  placeName: Yup.string()
    .max(100, 'Place name must be less than 100 characters'),
});

export const shortSchema = Yup.object().shape({
  caption: Yup.string()
    .max(500, 'Caption must be less than 500 characters')
    .required('Caption is required'),
  tags: Yup.string()
    .max(200, 'Tags must be less than 200 characters'),
  placeName: Yup.string()
    .max(100, 'Place name must be less than 100 characters'),
});

export const commentSchema = Yup.object().shape({
  text: Yup.string()
    .max(200, 'Comment must be less than 200 characters')
    .required('Comment text is required'),
});

export const resetPasswordSchema = Yup.object().shape({
  email: Yup.string()
    .email('Please enter a valid email')
    .required('Email is required'),
  token: Yup.string()
    .required('Token is required'),
  newPassword: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
    .required('New password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords must match')
    .required('Confirm password is required'),
});
