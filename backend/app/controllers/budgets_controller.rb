class BudgetsController < ApplicationController

  def index
    budgets = Budget.all
    render json: budgets
  end

  private

  def get_date(date_param)
    Date.parse(date_param)
  rescue StandardError
    Date.today
  end

end
