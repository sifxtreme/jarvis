class SlackMessageHandler
  def initialize(payload)
    @payload = payload.deep_stringify_keys
  end

  def process!
    client.chat_postMessage(
      channel: channel,
      thread_ts: thread_ts,
      text: response_text,
      mrkdwn: true
    )
  rescue StandardError => e
    Rails.logger.error "[Slack] Failed to process message: #{e.message}"
    client.chat_postMessage(
      channel: channel,
      thread_ts: thread_ts,
      text: "Sorry, something went wrong while processing that message."
    )
  end

  private

  def response_text
    if image_files.any?
      "Got the image! ✅\n\nSlack is wired up. Next step will be calendar extraction."
    elsif cleaned_text.present?
      "Got your message: \"#{cleaned_text}\" ✅\n\nSlack is wired up. This is a stub response for now."
    else
      "Slack is wired up. Send a message or image to test."
    end
  end

  def cleaned_text
    text = @payload['text'].to_s
    text.gsub(/<@[A-Z0-9]+>/, '').strip
  end

  def image_files
    Array(@payload['files']).select do |file|
      file['mimetype'].to_s.start_with?('image/')
    end
  end

  def channel
    @payload['channel']
  end

  def thread_ts
    @payload['thread_ts'] || @payload['ts']
  end

  def client
    @client ||= ::Slack::Web::Client.new(token: ENV['SLACK_BOT_TOKEN'])
  end
end
