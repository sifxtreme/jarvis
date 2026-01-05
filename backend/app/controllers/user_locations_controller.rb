class UserLocationsController < ApplicationController
  def index
    user = current_user
    return render json: { error: 'Unauthorized' }, status: :unauthorized unless user

    locations = user.user_locations.order(:label)
    render json: { locations: locations.map { |location| serialize(location) } }
  end

  def create
    user = current_user
    return render json: { error: 'Unauthorized' }, status: :unauthorized unless user

    data = params.permit(:label, :address, :latitude, :longitude, :time_zone)
    location = user.user_locations.create!(
      label: data[:label],
      address: data[:address],
      latitude: data[:latitude],
      longitude: data[:longitude],
      time_zone: data[:time_zone]
    )

    render json: { location: serialize(location) }
  end

  def update
    user = current_user
    return render json: { error: 'Unauthorized' }, status: :unauthorized unless user

    location = user.user_locations.find_by(id: params[:id])
    return render json: { error: 'Not found' }, status: :not_found unless location

    data = params.permit(:label, :address, :latitude, :longitude, :time_zone)
    location.update!(data.to_h.compact)

    render json: { location: serialize(location) }
  end

  def destroy
    user = current_user
    return render json: { error: 'Unauthorized' }, status: :unauthorized unless user

    location = user.user_locations.find_by(id: params[:id])
    return render json: { error: 'Not found' }, status: :not_found unless location

    location.destroy!
    render json: { success: true }
  end

  private

  def serialize(location)
    {
      id: location.id,
      label: location.label,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      time_zone: location.time_zone
    }
  end
end
