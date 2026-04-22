FROM nginx:alpine

# Copy all project files into Nginx's default content location
COPY . /usr/share/nginx/html

# Overwrite the default index.html with our popup.html
RUN cp /usr/share/nginx/html/popup.html /usr/share/nginx/html/index.html

EXPOSE 80
