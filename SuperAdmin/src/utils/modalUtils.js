/**
 * Utility functions for consistent modal state management
 */

/**
 * Close modal and reset related state
 * @param {Function} setShowModal - Function to set modal visibility
 * @param {Function} setSelectedItem - Function to clear selected item (optional)
 * @param {Function} resetForm - Function to reset form data (optional)
 */
export const closeModal = (setShowModal, setSelectedItem = null, resetForm = null) => {
  setShowModal(false)
  
  // Small delay to allow modal close animation
  setTimeout(() => {
    if (setSelectedItem) {
      setSelectedItem(null)
    }
    if (resetForm) {
      resetForm()
    }
  }, 200)
}

/**
 * Open modal and set selected item
 * @param {Function} setShowModal - Function to set modal visibility
 * @param {Function} setSelectedItem - Function to set selected item
 * @param {any} item - Item to select
 */
export const openModal = (setShowModal, setSelectedItem = null, item = null) => {
  if (setSelectedItem && item) {
    setSelectedItem(item)
  }
  setShowModal(true)
}

/**
 * Handle modal close with cleanup
 * @param {Function} setShowModal - Function to set modal visibility
 * @param {Function} setSelectedItem - Function to clear selected item (optional)
 * @param {Function} resetForm - Function to reset form data (optional)
 * @param {Function} onClose - Additional callback on close (optional)
 */
export const handleModalClose = (setShowModal, setSelectedItem = null, resetForm = null, onClose = null) => {
  closeModal(setShowModal, setSelectedItem, resetForm)
  if (onClose) {
    setTimeout(() => onClose(), 200)
  }
}

export default {
  closeModal,
  openModal,
  handleModalClose
}

