import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

const cn = (...inputs) => clsx(inputs)

const Modal = ({ isOpen, onClose, children, className, closeOnEscape = true, zIndex = 50 }) => {
  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, closeOnEscape, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center p-0 sm:p-4 overflow-y-auto" style={{ zIndex }}>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
        style={{ zIndex: zIndex - 1 }}
      />
      <div 
        className={cn(
          'relative bg-white rounded-none sm:rounded-lg shadow-2xl w-full flex flex-col',
          'h-screen sm:h-auto max-h-screen sm:max-h-[90vh]',
          'max-w-full sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-3xl',
          'mx-0 sm:mx-auto my-0 sm:my-auto',
          className
        )}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ zIndex }}
      >
        {children}
      </div>
    </div>
  )
}

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  closeOnEscape: PropTypes.bool,
  zIndex: PropTypes.number
}

const ModalHeader = ({ children, onClose, className }) => {
  return (
    <div className={cn(
      'flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 flex-shrink-0',
      'bg-white sticky top-0 z-10',
      className
    )}>
      {typeof children === 'string' ? (
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 pr-2">{children}</h3>
      ) : (
        <div className="flex-1 min-w-0">{children}</div>
      )}
      {onClose && (
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0 ml-3 p-1 rounded-md hover:bg-gray-100"
          aria-label="Close modal"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      )}
    </div>
  )
}

ModalHeader.propTypes = {
  children: PropTypes.node,
  onClose: PropTypes.func,
  className: PropTypes.string
}

const ModalContent = ({ children, className }) => {
  return (
    <div className={cn(
      'p-4 sm:p-6 overflow-y-auto flex-1 min-h-0',
      'bg-gray-50 sm:bg-white',
      className
    )}>
      {children || null}
    </div>
  )
}

ModalContent.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string
}

const ModalFooter = ({ children, className }) => {
  return (
    <div className={cn(
      'flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-3',
      'p-4 sm:p-6 border-t border-gray-200 flex-shrink-0 bg-white',
      'sticky bottom-0 z-10 shadow-lg sm:shadow-none',
      'rounded-none sm:rounded-b-lg',
      className
    )}>
      {children || null}
    </div>
  )
}

ModalFooter.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string
}

export { Modal, ModalHeader, ModalContent, ModalFooter }
