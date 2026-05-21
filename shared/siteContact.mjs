/** Public contact address (forwarding inbox). */
export const SHOWSKILLS_CONTACT_EMAIL = 'contact@showskills.co.uk'

export const CONTACT_TOPICS = [
  { id: 'general', label: 'General' },
  { id: 'complaint', label: 'Complaint' },
  { id: 'inquiry', label: 'Inquiry' },
  { id: 'cooperation', label: 'Cooperation request' },
  { id: 'feedback', label: 'Feedback' },
]

const TOPIC_IDS = new Set(CONTACT_TOPICS.map((t) => t.id))

export function contactTopicLabel(topicId) {
  return CONTACT_TOPICS.find((t) => t.id === topicId)?.label ?? 'General'
}

export function isValidContactTopic(topicId) {
  return TOPIC_IDS.has(topicId)
}
