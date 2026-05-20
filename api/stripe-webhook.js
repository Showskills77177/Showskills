import handler from '../backend/api/stripe-webhook.js'

export default handler

export const config = {
  api: {
    bodyParser: false,
  },
}
