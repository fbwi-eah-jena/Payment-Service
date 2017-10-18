CREATE DATABASE paymentdb;
CREATE TABLE paymentdb.orders (
  id int(10) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token varchar(255),
  json varchar(255),
  orderid varchar(255),
  price int(10),
  currency varchar(255) DEFAULT 'EUR',
  description varchar(255),
  status int(10) NOT NULL,
  firstname varchar(255),
  lastname varchar(255),
  street varchar(255),
  citycode int(10),
  city varchar(255)
);
