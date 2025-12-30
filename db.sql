CREATE DATABASE hospital;
USE hospital;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT ,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, 
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(5) NOT NULL CHECK (ROLE IN ("USER", "ADMIN")),
    PRIMARY KEY (user_id)
);

CREATE TABLE appointments (
    appointment_id INT AUTO_INCREMENT ,
    user_id INT,
    doctor_id INT,
    archive_id INT,
    appointment_date DATETIME NOT NULL CHECK (appointment_date >= CURRENT_DATE),
    description TEXT, 
    status VARCHAR(30) NOT NULL CHECK (status  IN ('accepted', 'booked', 'completed', 'cancelled')) DEFAULT 'booked',
	PRIMARY KEY (appointment_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE reservations(
	reservation_id INT AUTO_INCREMENT,
    user_id INT,
    archive_id INT,
    reservation_date DATETIME NOT NULL CHECK (reservation_date >= CURRENT_DATE),
    description TEXT, 
    status VARCHAR(30) NOT NULL CHECK (status  IN ('accepted','booked', 'completed', 'cancelled')) DEFAULT 'booked',
    room_id INT,
	PRIMARY KEY (reservation_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE doctors (
    doctor_id INT AUTO_INCREMENT ,
    name VARCHAR(255) NOT NULL,
    specialty VARCHAR(255),
    availability_start TIME,
    availability_end TIME,
     PRIMARY KEY (doctor_id)
);

CREATE TABLE rooms (
    room_id INT AUTO_INCREMENT ,
    room_name VARCHAR(255) NOT NULL,
    room_capacity INT NOT NULL,
    availability_start TIME,
    availability_end TIME,
    PRIMARY KEY (room_id)
    
);

CREATE TABLE archive (
    archive_id INT AUTO_INCREMENT , 
    type ENUM('appointment', 'reservation') NOT NULL,
    original_id INT NOT NULL,
    doctor_name VARCHAR(255), 
    room_name VARCHAR(255),
    date_time DATETIME,
    status VARCHAR(50),
    PRIMARY KEY(archive_id)
);

CREATE TABLE community (
    community_id INT(6) NOT NULL AUTO_INCREMENT ,
    images LONGBLOB NOT NULL,
    community_name VARCHAR(30) UNIQUE,
    description MEDIUMTEXT,
    link VARCHAR(70),
     PRIMARY KEY (community_id)
);

CREATE TABLE user_community (
	community_name varchar(30),
	user_id INT NOT NULL,
	date_joined timestamp,
	FOREIGN KEY (community_name) REFERENCES community(community_name),
	FOREIGN KEY (user_id) REFERENCES users(user_id),
    PRIMARY KEY (community_name, user_id)
);

CREATE TABLE articles (
    article_id INT(6) NOT NULL AUTO_INCREMENT ,
    images LONGBLOB NOT NULL,
    title VARCHAR(90) UNIQUE,
    description MEDIUMTEXT,
    link VARCHAR(70),
     PRIMARY KEY (article_id)
);

CREATE TABLE user_articles (
	title varchar(90) ,
	user_id int,
	FOREIGN KEY (title) REFERENCES articles(title),
	FOREIGN KEY (user_id) REFERENCES users(user_id),
    PRIMARY KEY (title, user_id)
);


ALTER TABLE reservations
ADD CONSTRAINT fk_room_id
FOREIGN KEY (room_id) REFERENCES rooms(room_id);

ALTER TABLE appointments
ADD CONSTRAINT fk_doc_id
FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id);

ALTER TABLE appointments
ADD CONSTRAINT fk_arc_id
FOREIGN KEY (archive_id) REFERENCES archive(archive_id);

ALTER TABLE reservations
ADD CONSTRAINT fk_arch_id
FOREIGN KEY (archive_id) REFERENCES archive(archive_id);