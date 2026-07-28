FROM node:20-alpine AS build-frontend
WORKDIR /src
COPY ../socihr-frontend ./
RUN npm install
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build-backend
WORKDIR /src
COPY . ./
RUN dotnet restore
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build-backend /app .
COPY --from=build-frontend /src/dist ./wwwroot
EXPOSE 8080
EXPOSE ${PORT:-8080}
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-8080} dotnet socihr-backend.dll"]
