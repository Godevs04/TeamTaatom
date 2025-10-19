import React from 'react'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

const cn = (...inputs) => clsx(inputs)

const Modal = ({ isOpen, onClose, children, className }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      <div className={cn(
        'relative bg-white rounded-lg shadow-lg max-w-md w-full mx-4',
        className
      )}>
        {children}
      </div>
    </div>
  )
}

const ModalHeader = ({ children, onClose }) => {
  return (
    <div className="flex items-center justify-between p-6 border-b">
      <h3 className="text-lg font-semibold">{children}</h3>
      {onClose && (
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}

const ModalContent = ({ children, className }) => {
  return (
    <div className={cn('p-6', className)}>
      {children}
    </div>
  )
}

const ModalFooter = ({ children, className }) => {
  return (
    <div className={cn('flex items-center justify-end space-x-2 p-6 border-t', className)}>
      {children}
    </div>
  )
}

export { Modal, ModalHeader, ModalContent, ModalFooter }
