class BudgetsController < ApplicationController

  def index
    b = Budget.all

    render json: b
  end

  private

  def get_date(date_param)
    Date.parse(date_param)
  rescue StandardError
    Date.today
  end

end
