require 'base64'
require 'net/http'

class SlackMessageHandler
  def initialize(payload)
    @payload = payload.deep_stringify_keys
  end

  def process!
    message = create_chat_message
    text = response_text(message)
    client.chat_postMessage(
      channel: channel,
      thread_ts: thread_ts,
      text: text,
      mrkdwn: true
    )
  rescue StandardError => e
    Rails.logger.error "[Slack] Failed to process message: #{e.message}"
    client.chat_postMessage(
      channel: channel,
      thread_ts: thread_ts,
      text: "Error: #{e.message}"
    )
  end

  private

  def response_text(message)
    if image_files.any?
      extract_from_image(message)
    elsif cleaned_text.present?
      extract_from_text(message)
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

  def extract_from_image(message)
    file = image_files.first
    base64 = download_file(file['url_private_download'] || file['url_private'])
    result = gemini.extract_event_from_image(base64, mime_type: file['mimetype'])
    log_ai_request(message, result[:usage], request_kind: 'image', status: result[:event]['error'] ? 'error' : 'success')
    render_extraction_result(result[:event])
  rescue StandardError => e
    log_ai_request(message, {}, request_kind: 'image', status: 'error', error_message: e.message)
    "Image extraction error: #{e.message}"
  end

  def extract_from_text(message)
    result = gemini.extract_event_from_text(cleaned_text)
    log_ai_request(message, result[:usage], request_kind: 'text', status: result[:event]['error'] ? 'error' : 'success')
    render_extraction_result(result[:event])
  end

  def render_extraction_result(event)
    if event['error']
      event['message'] || "I couldn't find event details in that message."
    else
      [
        "I found an event:",
        format_event(event),
        "Reply with any changes. (Calendar creation comes next.)"
      ].compact.join("\n\n")
    end
  end

  def format_event(event)
    lines = []
    lines << "Title: #{event['title']}" if event['title'].present?
    lines << "Date: #{event['date']}" if event['date'].present?
    time_range = [event['start_time'], event['end_time']].compact.join(' - ')
    lines << "Time: #{time_range}" if time_range.present?
    lines << "Location: #{event['location']}" if event['location'].present?
    lines << "Details: #{event['description']}" if event['description'].present?
    lines.join("\n")
  end

  def download_file(url)
    token = ENV['SLACK_BOT_TOKEN'].to_s
    raise "Missing SLACK_BOT_TOKEN" if token.empty?
    raise "Missing file URL" if url.to_s.empty?

    uri = URI(url)
    request = Net::HTTP::Get.new(uri)
    request['Authorization'] = "Bearer #{token}"

    response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
      http.request(request)
    end

    raise "Slack download failed: #{response.code}" unless response.is_a?(Net::HTTPSuccess)

    Base64.strict_encode64(response.body)
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

  def gemini
    @gemini ||= GeminiVision.new
  end

  def create_chat_message
    ChatMessage.create!(
      transport: 'slack',
      external_id: channel,
      thread_id: thread_ts,
      message_ts: @payload['ts'],
      sender_id: @payload['user'],
      text: cleaned_text.presence,
      has_image: image_files.any?,
      raw_payload: @payload
    )
  end

  def log_ai_request(message, usage, request_kind:, status:, error_message: nil)
    AiRequest.create!(
      chat_message: message,
      transport: 'slack',
      model: gemini_model,
      request_kind: request_kind,
      prompt_tokens: usage['promptTokenCount'],
      output_tokens: usage['candidatesTokenCount'],
      total_tokens: usage['totalTokenCount'],
      cost_usd: estimate_cost(usage),
      status: status,
      error_message: error_message,
      usage_metadata: usage
    )
  end

  def estimate_cost(usage)
    prompt = usage['promptTokenCount']
    output = usage['candidatesTokenCount']
    return nil if prompt.nil? || output.nil?

    input_cost = (prompt.to_f / 1_000_000) * 0.50
    output_cost = (output.to_f / 1_000_000) * 3.00
    (input_cost + output_cost).round(6)
  end

  def gemini_model
    'gemini-3-flash-preview'
  end
end
