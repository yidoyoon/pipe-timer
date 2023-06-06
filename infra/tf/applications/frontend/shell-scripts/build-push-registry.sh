#!/bin/bash

image_name="${REGISTRY_URL}/pipe-timer-frontend"
image_tag="${ENV}"
path="${PATH}"
front_url="${FRONT_URL}"

docker buildx build --platform linux/arm64 \
  --build-arg ENV_NAME_ARG="$image_tag" \
  --build-arg FRONT_URL_ARG="$front_url" \
  -t "$image_name":"$image_tag" \
  -o type=docker \
  --no-cache "$path"
docker push "$image_name":"$image_tag"
