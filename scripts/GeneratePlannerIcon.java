import java.awt.*;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.File;
import javax.imageio.ImageIO;

public class GeneratePlannerIcon {
  private static final Color GREEN = new Color(30, 116, 88);
  private static final Color DARK_GREEN = new Color(20, 88, 67);
  private static final Color MINT = new Color(218, 241, 231);
  private static final Color INK = new Color(48, 83, 68);

  private static BufferedImage drawIcon(int size) {
    BufferedImage image = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
    Graphics2D g = image.createGraphics();
    g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
    g.scale(size / 512.0, size / 512.0);
    g.setPaint(new GradientPaint(0, 0, new Color(42, 137, 102), 512, 512, DARK_GREEN));
    g.fillRect(0, 0, 512, 512);
    g.setColor(new Color(255, 255, 255, 18));
    g.fillOval(325, -104, 290, 290);
    g.fillOval(-142, 350, 310, 310);
    g.setColor(new Color(0, 0, 0, 35));
    g.fill(new RoundRectangle2D.Float(116, 91, 290, 350, 54, 54));
    g.setColor(new Color(250, 253, 251));
    g.fill(new RoundRectangle2D.Float(108, 78, 290, 350, 54, 54));
    g.setColor(MINT);
    g.fill(new RoundRectangle2D.Float(151, 119, 204, 52, 24, 24));
    g.setColor(GREEN);
    g.fill(new RoundRectangle2D.Float(169, 137, 126, 12, 6, 6));
    g.fill(new RoundRectangle2D.Float(307, 132, 12, 25, 6, 6));
    g.fill(new RoundRectangle2D.Float(327, 132, 12, 25, 6, 6));
    int[] rowY = {215, 282, 349};
    for (int y : rowY) {
      g.setColor(MINT);
      g.fill(new RoundRectangle2D.Float(151, y, 43, 43, 14, 14));
      g.setColor(GREEN);
      g.setStroke(new BasicStroke(6, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
      g.drawLine(162, y + 22, 173, y + 32);
      g.drawLine(173, y + 32, 187, y + 13);
      g.setColor(INK);
      g.fill(new RoundRectangle2D.Float(214, y + 8, 125, 9, 5, 5));
      g.setColor(new Color(183, 207, 194));
      g.fill(new RoundRectangle2D.Float(214, y + 26, 91, 7, 4, 4));
    }
    g.dispose();
    return image;
  }

  private static void write(BufferedImage image, String path) throws Exception {
    File output = new File(path);
    output.getParentFile().mkdirs();
    ImageIO.write(image, "png", output);
  }

  public static void main(String[] args) throws Exception {
    String project = new File(".").getCanonicalPath();
    write(drawIcon(512), project + "/market-assets/planner-icon-512.png");
    int[] sizes = {48, 72, 96, 144, 192};
    String[] densities = {"mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"};
    for (int i = 0; i < sizes.length; i++) {
      BufferedImage icon = drawIcon(sizes[i]);
      String dir = project + "/android/app/src/main/res/mipmap-" + densities[i] + "/";
      write(icon, dir + "ic_launcher.png");
      write(icon, dir + "ic_launcher_round.png");
    }
  }
}
