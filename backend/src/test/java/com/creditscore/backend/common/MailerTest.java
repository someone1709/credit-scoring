package com.creditscore.backend.common;

import static org.assertj.core.api.Assertions.assertThat;

import com.creditscore.backend.config.AppProperties;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class MailerTest {

    private static AppProperties withMail(String host, int port, String from) {
        return new AppProperties(null, null, null, null, null, null, null, new AppProperties.Mail(host, port, "", "", from, false), null);
    }

    @Test
    void isOffWithoutAHostOrASender() {
        assertThat(new Mailer(withMail("", 587, "from@example.com")).isEnabled()).isFalse();
        assertThat(new Mailer(withMail("smtp.example.com", 587, "")).isEnabled()).isFalse();
        assertThat(new Mailer(withMail("smtp.example.com", 587, "from@example.com")).isEnabled()).isTrue();
    }

    @Test
    void sendsThroughTheSmtpServiceInItsSettings() throws Exception {
        try (ServerSocket server = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
            CompletableFuture<String> received = CompletableFuture.supplyAsync(() -> acceptOneMessage(server));

            Mailer mailer = new Mailer(withMail(server.getInetAddress().getHostAddress(), server.getLocalPort(), "from@example.com"));
            mailer.send("someone@example.com", "A subject", "The body");

            assertThat(received.get(15, TimeUnit.SECONDS))
                    .contains("MAIL FROM:<from@example.com>")
                    .contains("RCPT TO:<someone@example.com>")
                    .contains("Subject: A subject")
                    .contains("The body");
        }
    }

    /** Just enough of SMTP to take one message, and returns everything the client said. */
    private static String acceptOneMessage(ServerSocket server) {
        StringBuilder said = new StringBuilder();
        try (Socket socket = server.accept();
             BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
             PrintWriter out = new PrintWriter(socket.getOutputStream(), true, StandardCharsets.UTF_8)) {
            out.print("220 test\r\n");
            out.flush();
            boolean inData = false;
            String line;
            while ((line = in.readLine()) != null) {
                said.append(line).append('\n');
                String reply = "250 OK";
                if (inData) {
                    if (!line.equals(".")) continue;
                    inData = false;
                } else if (line.startsWith("DATA")) {
                    inData = true;
                    reply = "354 go on";
                } else if (line.startsWith("QUIT")) {
                    out.print("221 bye\r\n");
                    out.flush();
                    break;
                }
                out.print(reply + "\r\n");
                out.flush();
            }
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        return said.toString();
    }
}
