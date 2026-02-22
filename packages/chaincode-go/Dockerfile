# Build stage
FROM golang:1.22-alpine AS build
RUN apk add --no-cache git
WORKDIR /chaincode
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o chaincode .

# Runtime stage
FROM alpine:3.19
COPY --from=build /chaincode/chaincode /usr/local/bin/chaincode
EXPOSE 9999
CMD ["chaincode"]
