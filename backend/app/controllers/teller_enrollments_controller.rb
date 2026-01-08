class TellerEnrollmentsController < ApplicationController
  def show
    user = current_user
    return render json: { error: 'Unauthorized' }, status: :unauthorized unless user

    enrollment = TellerEnrollment.where(user: user).order(updated_at: :desc).first
    return render json: { enrollment: nil } unless enrollment

    render json: { enrollment: serialize(enrollment) }
  end

  def create
    user = current_user
    return render json: { error: 'Unauthorized' }, status: :unauthorized unless user

    application_id = params[:application_id].to_s.strip
    enrollment_id = params[:enrollment_id].to_s.strip

    if application_id.empty? || enrollment_id.empty?
      render json: { error: 'application_id and enrollment_id are required' }, status: :bad_request
      return
    end

    record = TellerEnrollment.find_or_initialize_by(user: user, enrollment_id: enrollment_id)
    record.application_id = application_id
    record.save!

    render json: { enrollment: serialize(record) }
  end

  private

  def serialize(enrollment)
    {
      id: enrollment.id,
      application_id: enrollment.application_id,
      enrollment_id: enrollment.enrollment_id,
      updated_at: enrollment.updated_at&.iso8601
    }
  end
end
