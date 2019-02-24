class TestJobX

  @queue = :test

  def self.perform
    Dummy.create!
  end

end
