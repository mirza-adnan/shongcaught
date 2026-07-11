#!/usr/bin/env bash

case "$1" in
  yeamin)
    git config --local user.name "Yeamin Alam"
    git config --local user.email "7yeamin@gmail.com"
    ;;
  mas)
    git config --local user.name "Masroor Morshed"
    git config --local user.email "mas.morshed2424@gmail.com"
    ;;
  adnan)
    git config --local user.name "Mirza Adnan"
    git config --local user.email "mirza.adnan2205@gmail.com"
    ;;
  *)
    ;;
esac

echo "Switched git identity to:"
git config --local user.name
git config --local user.email