/**
 * Utility to escape user input before it's used inside a MongoDB $regex.
 *
 * Without this, raw user input passed into $regex is interpreted as regex
 * syntax rather than literal characters -- at minimum breaking searches for
 * terms containing characters like "(", ")", "[", "]", "." (unbalanced or
 * reinterpreted), and at worst allowing a crafted pattern to trigger
 * catastrophic backtracking (ReDoS) and hang the request, since MongoDB's
 * $regex uses PCRE-style matching with the same vulnerability class as a
 * naive JS regex.
 */

/**
 * Escape MongoDB/JS regex special characters so a string matches literally.
 * @param {*} str - Value to escape. Coerced to a string first, since not
 *   every $regex call site is guaranteed to already receive one (e.g. a
 *   query param could arrive as something other than a plain string).
 * @returns {string} - The value with regex metacharacters escaped
 */
const escapeRegex = (str) => {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

module.exports = {
  escapeRegex
};
