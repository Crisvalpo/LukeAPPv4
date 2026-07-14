import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', loading = false, children, ...props }, ref) => {
    
    const baseStyles = 'inline-flex items-center justify-center font-semibold transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed rounded-md';
    
    const variants = {
      primary: 'bg-accent text-panel hover:bg-sky-400',
      secondary: 'bg-card text-foreground hover:bg-border border border-border',
      danger: 'bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20',
      outline: 'bg-transparent border border-border text-foreground hover:bg-card',
      ghost: 'bg-transparent text-foreground hover:bg-card hover:text-accent',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Procesando...
          </span>
        ) : children}
      </button>
    );
  }
);
Button.displayName = 'Button';
