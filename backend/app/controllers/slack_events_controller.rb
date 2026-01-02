class SlackEventsController < WebhookController
  before_action :verify_slack_request

  def events
    case params[:type]
    when 'url_verification'
      render json: { challenge: params[:challenge] }
    when 'event_callback'
      handle_event(params[:event] || {})
      head :ok
    else
      head :ok
    end
  end

  private

  def handle_event(event)
    return if event['bot_id'].present?
    return if event['subtype'].present? && event['subtype'] != 'file_share'

    return unless supports_event?(event)

    Resque.enqueue(
      SlackMessageJob,
      channel: event['channel'],
      thread_ts: event['thread_ts'] || event['ts'],
      text: event['text'],
      files: event['files'],
      ts: event['ts']
    )
  end

  def supports_event?(event)
    return true if event['type'] == 'app_mention'

    event['type'] == 'message' && event['channel_type'] == 'im'
  end

  def verify_slack_request
    return if Rails.env.development? && ENV['SLACK_SIGNING_SECRET'].blank?

    timestamp = request.headers['X-Slack-Request-Timestamp'].to_s
    signature = request.headers['X-Slack-Signature'].to_s

    if timestamp.blank? || signature.blank?
      head :unauthorized
      return
    end

    if (Time.now.to_i - timestamp.to_i).abs > 300
      head :unauthorized
      return
    end

    sig_basestring = "v0:#{timestamp}:#{request.raw_post}"
    expected = 'v0=' + OpenSSL::HMAC.hexdigest(
      'SHA256',
      ENV['SLACK_SIGNING_SECRET'],
      sig_basestring
    )

    return if ActiveSupport::SecurityUtils.secure_compare(expected, signature)

    head :unauthorized
  end
end
