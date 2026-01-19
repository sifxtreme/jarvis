require 'chat_flows/event'
require 'chat_flows/transaction'
require 'chat_flows/memory'

module ChatFlows
  class Registry
    def initialize(handler)
      @handler = handler
      @flows = {
        event: ChatFlows::Event.new(handler),
        transaction: ChatFlows::Transaction.new(handler),
        memory: ChatFlows::Memory.new(handler)
      }
    end

    def fetch(kind)
      @flows.fetch(kind)
    end
  end
end
