class TestJobX

  @queue = :dummy

  def self.perform
    Dummy.create!
  end

end
