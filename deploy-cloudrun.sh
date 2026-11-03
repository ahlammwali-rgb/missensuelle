#!/usr/bin/env bash
set -e

echo "===================================================="
echo "  Déploiement de Miss Sensuelle sur Google Cloud Run"
echo "===================================================="

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
  echo "Aucun projet Google Cloud sélectionné."
  echo "Liste de vos projets existants :"
  gcloud projects list
  read -p "Entrez l'ID de votre projet Google Cloud (ou appuyez sur Entrée pour créer 'miss-sensuelle-dz') : " INPUT_PROJECT
  if [ -z "$INPUT_PROJECT" ]; then
    PROJECT_ID="miss-sensuelle-$(date +%s | tail -c 5)"
    echo "Création du projet $PROJECT_ID..."
    gcloud projects create "$PROJECT_ID" --name="Miss Sensuelle"
  else
    PROJECT_ID="$INPUT_PROJECT"
  fi
  gcloud config set project "$PROJECT_ID"
fi

echo "Projet actif : $PROJECT_ID"
echo "Activation des services Cloud Run, Cloud Build et Artifact Registry..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project="$PROJECT_ID"

echo "Lancement du déploiement sur Cloud Run (région: europe-west1)..."
gcloud run deploy missensuelle \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars="NODE_ENV=production,ADMIN_PASSWORD=DBZ1995"

echo "===================================================="
echo "  Déploiement terminé avec succès !"
echo "  Mot de passe Admin (/admin) : DBZ1995"
echo "===================================================="
