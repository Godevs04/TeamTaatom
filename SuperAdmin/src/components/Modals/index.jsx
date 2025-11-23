import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

const cn = (...inputs) => clsx(inputs)

const Modal = ({ isOpen, onClose, children, className, closeOnEscape = true }) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div 
        className={cn(
          'relative bg-white rounded-lg shadow-lg max-w-md w-full mx-4 z-50',
          className
        )}
        role="dialog"
        aria-modal="true"
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
  closeOnEscape: PropTypes.bool
}

const ModalHeader = ({ children, onClose }) => {
  return (
    <div className="flex items-center justify-between p-6 border-b">
      <h3 className="text-lg font-semibold">{children || ''}</h3>
      {onClose && (
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}

ModalHeader.propTypes = {
  children: PropTypes.node,
  onClose: PropTypes.func
}

const ModalContent = ({ children, className }) => {
  return (
    <div className={cn('p-6', className)}>
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
    <div className={cn('flex items-center justify-end space-x-2 p-6 border-t', className)}>
      {children || null}
    </div>
  )
}

ModalFooter.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string
}

export { Modal, ModalHeader, ModalContent, ModalFooter }
