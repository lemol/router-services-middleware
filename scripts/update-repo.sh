FETCH_ROUTER_VERSION='https:\/\/github.com\/lemol\/fetch-router-extra.git'

cp -rf ${REMIX_SOURCE}/src/* ./src/
cp -rf ${REMIX_SOURCE}/{package.json,README.md} ./

sed -i '' 's/"@remix-run\/fetch-router-extra": "workspace:\^"/"fetch-router-extra": "'${FETCH_ROUTER_VERSION}'"/g' package.json

find . -name "package.json" -o -name "*.ts" -path "*/src/*" | \
xargs sed -i '' \
  -e 's/@remix-run\/router-services-middleware/router-services-middleware/g' \
  -e 's/@remix-run\/fetch-router-extra/fetch-router-extra/g'

sed -i ''  's/workspace:\^/0/g' package.json

sed -i '' '/"peerDependencies"/,/^  }/d' package.json

rm -rf node_modules
rm -rf pnpm-lock.yaml

pnpm update
