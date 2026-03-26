# Image URL to use all building/pushing image targets
REGISTRY ?= quay.io
REPOSITORY ?= $(REGISTRY)/eformat/rhai-workshop-plugin

IMG := $(REPOSITORY):latest

# clean compile
compile:
	yarn run build

# Podman Login
podman-login:
	@podman login -u $(DOCKER_USER) -p $(DOCKER_PASSWORD) $(REGISTRY)

# Build the oci image no compile
podman-build-nocompile:
	podman build --no-cache . -t ${IMG} -f Containerfile

# Build the oci image
podman-build: compile
	podman build . -t ${IMG} -f Containerfile

# Push the oci image
podman-push:
	podman push ${IMG}

# Push the oci image
podman-push-nocompile: podman-build-nocompile
	podman push ${IMG}

# Just Push the oci image
podman-push-nobuild:
	podman push ${IMG}
