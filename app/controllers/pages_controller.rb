class PagesController < ApplicationController
  def show
    path = (params[:id].to_s == "home") ? Pathname.new("/home") : Pathname.new("/")
    render :template => "pages/#{path.cleanpath.to_s[1..-1]}"
  end
end
