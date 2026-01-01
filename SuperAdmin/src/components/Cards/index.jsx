import { clsx } from 'clsx'

const cn = (...inputs) => clsx(inputs)

const Card = ({ className, children, ...props }) => {
  return (
    <div
      className={cn(
        'rounded-lg border bg-white shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

const CardHeader = ({ className, ...props }) => {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      {...props}
    />
  )
}

const CardTitle = ({ className, ...props }) => {
  return (
    <h3
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
}

const CardDescription = ({ className, ...props }) => {
  return (
    <p
      className={cn('text-sm text-gray-600', className)}
      {...props}
    />
  )
}

const CardContent = ({ className, ...props }) => {
  return (
    <div className={cn('p-6 pt-0', className)} {...props} />
  )
}

const CardFooter = ({ className, ...props }) => {
  return (
    <div
      className={cn('flex items-center p-6 pt-0', className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
}
